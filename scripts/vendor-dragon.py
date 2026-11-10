"""One-time import of data only, from an explicitly reviewed CC0 publisher."""
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib, json, struct
BASE = 'https://grab3d.com/dl/chinese-dragon/'
OUT = Path('assets/dragon')
OUT.mkdir(parents=True, exist_ok=True)

def download(name):
    req = Request(BASE + name, headers={'User-Agent': 'CrystalWell asset importer/0.4'})
    with urlopen(req, timeout=120) as response:
        data = response.read(40_000_001)
    if len(data) > 40_000_000:
        raise ValueError('Asset exceeds import limit')
    return data

license_data = download('LICENSE.txt')
manifest = json.loads(download('manifest.json'))
assert manifest['extras']['license'] == 'CC0-1.0'
assert b'CC0' in license_data
asset = download('chinese-dragon-light.glb')
assert len(asset) == manifest['files']['glb_light']['bytes']
magic, version, size = struct.unpack_from('<4sII', asset)
assert magic == b'glTF' and version == 2 and size == len(asset)
size_json, kind = struct.unpack_from('<II', asset, 12)
assert kind == 0x4E4F534A
scene = json.loads(asset[20:20+size_json])
# No external resources: this source is a self-contained model, not code.
for resource in scene.get('buffers', []) + scene.get('images', []):
    assert 'uri' not in resource or resource['uri'].startswith('data:')
(OUT / 'chinese-dragon-source.glb').write_bytes(asset)
(OUT / 'LICENSE.txt').write_bytes(license_data)
(OUT / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(OUT / 'provenance.json').write_text(json.dumps({
    'publisher': 'Grab3D', 'page': 'https://grab3d.com/models/creatures/chinese-dragon/',
    'download': BASE + 'chinese-dragon-light.glb',
    'license': 'CC0-1.0', 'sha256': hashlib.sha256(asset).hexdigest(),
    'origin': manifest['origin'], 'bytes': len(asset),
    'note': 'External model, not authored by CrystalWell. AI-assisted origin disclosed by publisher.'
}, indent=2) + '\n')
print(json.dumps({'sha256': hashlib.sha256(asset).hexdigest(), 'mesh_count':len(scene.get('meshes',[])),
                  'nodes':scene.get('nodes'), 'accessors':scene.get('accessors')}, indent=2))
