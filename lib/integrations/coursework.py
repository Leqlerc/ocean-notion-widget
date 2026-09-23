"""Exact Brightspace course and obligation identities, shared by reads and sync."""
import re
from datetime import datetime
from urllib.parse import urlsplit, parse_qs
from lib import notion

ORG_COURSES = {'1640342':'MFET 163','1631262':'CS 159','1636988':'HONR 19901',
               '1634573':'ENGR 161','36061':'COM 114','1134648':'Purdue requirements'}
LIFECYCLE = re.compile(r'\s+[-–—]\s+(Available|Availability Ends)\s*$',re.I)
SUFFIX = re.compile(r'\s+[-–—]\s+(Due|Available|Availability Ends)\s*$',re.I)
PREFIX = re.compile(r'^\s*[A-Z]{2,5}\s*\d{3,5}\s*[:–—-]\s*',re.I)


def org_unit(url):
    parts=urlsplit(url or '')
    if parts.hostname!='purdue.brightspace.com': return ''
    query=parse_qs(parts.query)
    match=re.search(r'/d2l/(?:le/(?:content|calendar)|lms/(?:dropbox|quizzing))/(\d+)(?:/|$)',parts.path)
    return (query.get('ou') or [match.group(1) if match else ''])[0]


def course_for(name,url,explicit=''):
    unit=org_unit(url)
    if unit in ORG_COURSES: return ORG_COURSES[unit]
    if explicit: return explicit
    match=re.search(r'\b([A-Z]{2,5})\s*(\d{3,5})\b',name or '')
    return ' '.join(match.groups()) if match else ''


def title_key(name):
    title=PREFIX.sub('',name or '')
    title=re.sub(r'^Submission Folder Special Access:\s*','',title,flags=re.I)
    title=PREFIX.sub('',title)
    # Keep internal punctuation and numbers: no fuzzy matching.
    return re.sub(r'\s+',' ',SUFFIX.sub('',title)).strip().casefold()


def course_key(item):
    url=item.get('sourceUrl') or item.get('url','')
    course=course_for(item.get('name'),url,item.get('course',''))
    if course: return re.sub(r'\s+','',course).casefold()
    unit=org_unit(url)
    return 'org:'+unit if unit and unit!='6824' else ''


def identity(item):
    course=course_key(item)
    due=item.get('due')
    if not course or not due: return None
    value=datetime.fromisoformat(due.replace('Z','+00:00'))
    if len(due)==10: value=value.replace(hour=23,minute=59)
    if value.tzinfo is None: value=value.replace(tzinfo=notion.TZ)
    return course,title_key(item.get('name')),value.astimezone(notion.TZ).isoformat()


def actionable(items):
    """Suppress lifecycle notifications only when the matching real due item exists."""
    due_keys={(course_key(i),title_key(i['name'])) for i in items
              if not LIFECYCLE.search(i['name']) and course_key(i)}
    return [i for i in items if not (LIFECYCLE.search(i['name']) and
            ((course_key(i),title_key(i['name'])) in due_keys or
             re.match(r'^Week\s+\d+\s*[|:] ',i['name'],re.I)))]


def canonical_rank(item):
    generated=str(item.get('sourceId','')).startswith('brightspace:')
    owned=sum(bool(item.get(k)) for k in ('focus','scheduledFor','project','projectIds'))
    owned+=item.get('planningMode','automatic')!='automatic'
    owned+=item.get('difficulty','Unrated')!='Unrated'
    return generated,-owned,item.get('status')!='done',bool(LIFECYCLE.search(item['name'])),bool(SUFFIX.search(item['name'])),item.get('id','')


def visible_tasks(items):
    """Hide deterministic generated noise while keeping all user-created records."""
    normalized=[{**i,'course':course_for(i['name'],i.get('sourceUrl'),i.get('course',''))}
                if str(i.get('sourceId','')).startswith('brightspace:') else i for i in items]
    active_ids={i['id'] for i in actionable(normalized)}
    groups={}
    for item in normalized:
        key=identity(item)
        if key: groups.setdefault(key,[]).append(item)
    redundant=set()
    for group in groups.values():
        chosen=min(group,key=canonical_rank)
        for item in group:
            if item is not chosen and str(item.get('sourceId','')).startswith('brightspace:'):
                # Conflicting user state stays visible until explicitly reconciled.
                if compatible(chosen,item): redundant.add(item['id'])
    return [i for i in normalized if i['id'] not in redundant and
            (i['id'] in active_ids or not str(i.get('sourceId','')).startswith('brightspace:'))]


def compatible(canonical,redundant):
    for field,default in [('planningMode','automatic'),('scheduledFor',None),('focus',False),
                          ('difficulty','Unrated'),('project',''),('projectIds',[])]:
        value=redundant.get(field,default)
        if value!=default and value!=canonical.get(field,default): return False
    if redundant.get('status') not in (None,'inbox','next',canonical.get('status')): return False
    return True
