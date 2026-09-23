"""Read-only reconciliation report. Private snapshots/reports must stay out of Git."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from lib.integrations.reconciliation import plan

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    result=plan(json.loads(args.snapshot.read_text(encoding='utf-8'))['tasks'])
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'deterministicDuplicates':len(result['pairs']),'conflicts':len(result['conflicts']),'digest':result['digest']}))
