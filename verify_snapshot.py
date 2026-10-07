import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parent
m=json.loads((root/'PROVENANCE.json').read_text())
for entry in m['sourceFiles']:
    b=(root/entry['path']).read_bytes()
    blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    assert blob==entry['gitBlobSha'], 'Original Git blob mismatch: '+entry['path']
    assert hashlib.sha256(b).hexdigest()==entry['sha256'], 'Snapshot hash mismatch: '+entry['path']
for line in (root/'SNAPSHOT.sha256').read_text().splitlines():
    h,n=line.split(None,1)
    assert hashlib.sha256((root/n.strip()).read_bytes()).hexdigest()==h, 'Snapshot drift: '+n
print('All snapshot and original source blob hashes verified')
