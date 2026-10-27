"""Build a portable, single-file preview using the site's existing font assets."""
from pathlib import Path
import base64
root=Path(__file__).resolve().parents[2]
source=Path(__file__).with_name('preview.html')
fonts=root/'src/assets/fonts/barlow'
faces=[('Barlow','7cHpv4kjgoGqM7E_DMs5.woff2','400'),('Barlow','7cHqv4kjgoGqM7E3_-gs6FospT4.woff2','600'),('Barlow Condensed','HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3bWuQ.woff2','600')]
css='\n'.join(f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{weight};font-display:swap;src:url(data:font/woff2;base64,{base64.b64encode((fonts/file).read_bytes()).decode()}) format('woff2')}}" for name,file,weight in faces)
target=source.with_name('index.html')
target.write_text(source.read_text(encoding='utf8').replace('/* PREVIEW_FONTS */',css),encoding='utf8')
print(f'Portable preview: {target} ({target.stat().st_size:,} bytes)')
