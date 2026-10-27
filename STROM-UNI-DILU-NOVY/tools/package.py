from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
target=ROOT.parent/'auto-lenc-oleje-github.zip'
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(ROOT.rglob('*')):
        relative=file.relative_to(ROOT)
        if file.is_file() and not any(part in ['.cache','__pycache__'] for part in relative.parts) and file.suffix!='.pyc':
            archive.write(file,relative)
print(target)
