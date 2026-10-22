"""Build the circular Luo Chat wordmark as font outlines (no runtime font dependency)."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from pathlib import Path

def word(text, font_path, size, baseline, tracking=0):
    font=TTFont(font_path); glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); scale=size/font['head'].unitsPerEm
    advances=[glyphs[cmap[ord(c)]].width*scale for c in text]; width=sum(advances)+tracking*(len(text)-1);x=(512-width)/2
    paths=[]
    for c,advance in zip(text,advances):
        pen=SVGPathPen(glyphs);glyphs[cmap[ord(c)]].draw(TransformPen(pen,(scale,0,0,-scale,x,baseline)));paths.append('<path d="'+pen.getCommands()+'"/>');x+=advance+tracking
    return ''.join(paths)
logo='''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title"><title id="title">Luo Chat — gold wordmark on black</title><defs><linearGradient id="gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#FFF0B9"/><stop offset=".45" stop-color="#E7C66E"/><stop offset="1" stop-color="#B98A30"/></linearGradient><radialGradient id="black"><stop stop-color="#1B1914"/><stop offset="1" stop-color="#050505"/></radialGradient></defs><rect width="512" height="512" fill="#050505"/><circle cx="256" cy="256" r="223" fill="url(#black)" stroke="url(#gold)" stroke-width="5"/><circle cx="256" cy="256" r="207" fill="none" stroke="#D7B65F" stroke-opacity=".38" stroke-width="1"/><g fill="url(#gold)">'''
logo+=word('Luo','/usr/share/fonts/opentype/urw-base35/P052-Roman.otf',151,269,-3)
logo+='<path d="M188 300h136" stroke="url(#gold)" stroke-width="1.4"/><path d="m256 291 5 9-5 9-5-9Z"/>'
logo+=word('Chat','/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf',65,382,7)
logo+='</g></svg>\n'
Path('public/icon.svg').write_text(logo)
