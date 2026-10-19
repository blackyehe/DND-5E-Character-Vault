"""Create the readable learning guide, with native PDF contents and bookmarks.

Requires Python 3 and reportlab. Run from any directory:
    python scripts/build-learning-guide-pdf.py
The Markdown guide remains the editable source of truth.
"""
from pathlib import Path
import argparse
import html
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Flowable, CondPageBreak,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/PROJECT_HISTORY_AND_LEARNING_GUIDE.md'
INK, MUTED, ACCENT = '#242b35', '#5c6675', '#8a263d'


def slug(value):
    return re.sub(r'[^\w\- ]', '', value.lower()).replace(' ', '-')


def clean(value):
    return re.sub('[\u2010-\u2015\u2212]', '-', value).replace('\u2192', ' -> ')


def register_fonts():
    candidates = [Path('C:/Windows/Fonts'), Path('/usr/share/fonts/truetype/dejavu')]
    sets = [('calibri.ttf', 'calibrib.ttf', 'calibrii.ttf', 'calibriz.ttf'),
            ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf')]
    for directory, names in zip(candidates, sets):
        if all((directory / name).exists() for name in names):
            for family, name in zip(('Guide', 'GuideBold', 'GuideItalic', 'GuideBoldItalic'), names):
                pdfmetrics.registerFont(TTFont(family, str(directory / name)))
            pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='GuideItalic', boldItalic='GuideBoldItalic')
            return
    raise RuntimeError('Install Calibri or DejaVu Sans before building the guide.')


def inline(value):
    """Small, escaped inline renderer for the Markdown used by this guide."""
    pattern = r'(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))'
    parts = []
    for token in re.split(pattern, value):
        if token.startswith('`') and token.endswith('`'):
            parts.append('<font color="#485567">' + html.escape(clean(token[1:-1])) + '</font>')
        elif token.startswith('**') and token.endswith('**'):
            parts.append('<b>' + html.escape(clean(token[2:-2])) + '</b>')
        elif (match := re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', token)):
            label, target = match.groups()
            label = html.escape(clean(label))
            if target.startswith(('#', 'https://', 'http://')):
                parts.append(f'<link href="{html.escape(target, quote=True)}" color="{ACCENT}">{label}</link>')
            else:
                # PDF readers often block local-file actions; code filenames remain readable.
                parts.append(f'<font color="{ACCENT}">{label}</font>')
        else:
            parts.append(html.escape(clean(token)))
    return ''.join(parts)


class Diagram(Flowable):
    """Two small vector diagrams corresponding to the Markdown Mermaid blocks."""
    def __init__(self, kind, width):
        super().__init__()
        self.kind, self.width = kind, width
        self.height = 265 if kind == 'architecture' else 220

    def draw(self):
        c = self.canv
        c.setFont('Guide', 9)
        c.setStrokeColor(colors.HexColor('#ccd2db'))
        if self.kind == 'architecture':
            w, x = 270, (self.width - 270) / 2
            labels = [
                'Vue pages and components', 'Shared browser state (Pinia)',
                'Express API and permission checks', 'Database and shared rules',
                'Owner packs, local SRD, external fallback',
            ]
            for i, label in enumerate(labels):
                y = self.height - 42 - i * 47
                c.setFillColor(colors.HexColor('#f3f5f8'))
                c.roundRect(x, y, w, 32, 5, fill=1, stroke=1)
                c.setFillColor(colors.HexColor(INK))
                c.drawCentredString(x + w / 2, y + 12, label)
                if i < len(labels) - 1:
                    mid = x + w / 2
                    c.line(mid, y - 2, mid, y - 12)
                    c.line(mid, y - 12, mid - 3, y - 8)
                    c.line(mid, y - 12, mid + 3, y - 8)
            c.setFillColor(colors.HexColor(MUTED))
            c.drawCentredString(self.width / 2, 8, 'Responsibilities, simplified from the source diagram.')
        else:
            xs = [55, self.width / 2, self.width - 55]
            for x, label in zip(xs, ('Browser', 'App server', 'Database')):
                c.setFillColor(colors.HexColor(ACCENT))
                c.drawCentredString(x, self.height - 15, label)
                c.line(x, 25, x, self.height - 25)
            messages = [
                (0, 1, 'Open authorised quick sheet'), (1, 2, 'Read saved character'),
                (2, 1, 'Saved values'), (1, 0, 'Usable sheet first'),
                (0, 1, 'Resolve scoped references'), (1, 2, 'Check rules and revisions'),
                (2, 1, 'Needed rules'), (1, 0, 'Latest resolved references'),
            ]
            for i, (start, end, label) in enumerate(messages):
                y = self.height - 43 - i * 19
                a, b = xs[start], xs[end]
                c.setFillColor(colors.HexColor(INK))
                c.setFont('Guide', 7.4)
                c.drawCentredString((a + b) / 2, y + 4, label)
                c.line(a, y, b, y)
                tip = 1 if b > a else -1
                c.line(b, y, b - 4 * tip, y + 2)
                c.line(b, y, b - 4 * tip, y - 2)


class GuideDoc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(str(path), pagesize=A4, leftMargin=46, rightMargin=46,
                         topMargin=53, bottomMargin=45, title='Codex of Heroes - Project history and learning guide',
                         author='Codex of Heroes', pageCompression=1)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='Guide', frames=[frame], onPage=self.furniture))

    def furniture(self, c, doc):
        c.saveState()
        c.setFillColor(colors.HexColor(MUTED))
        c.setFont('Guide', 8)
        c.drawString(self.leftMargin, A4[1] - 30, 'CODEX OF HEROES  /  PROJECT HISTORY AND LEARNING GUIDE')
        c.drawRightString(A4[0] - self.rightMargin, 25, str(doc.page))
        c.setStrokeColor(colors.HexColor('#e0e4e9'))
        c.line(self.leftMargin, 37, A4[0] - self.rightMargin, 37)
        c.drawString(self.leftMargin, 25, '19 October 2026  |  Editable source: docs/PROJECT_HISTORY_AND_LEARNING_GUIDE.md')
        c.restoreState()

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'guide_anchor'):
            key, title, level = flowable.guide_anchor
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(clean(title), key, level=level, closed=False)


def make_styles():
    body = ParagraphStyle('Body', fontName='Guide', fontSize=10.3, leading=14.5,
                          textColor=colors.HexColor(INK), spaceAfter=7,
                          splitLongWords=True, allowWidows=0, allowOrphans=0)
    return {
        'body': body,
        'title': ParagraphStyle('Title', parent=body, fontName='GuideBold', fontSize=28, leading=33, textColor=colors.HexColor(ACCENT), spaceAfter=17),
        'h2': ParagraphStyle('H2', parent=body, fontName='GuideBold', fontSize=19, leading=24, spaceBefore=10, spaceAfter=13, keepWithNext=True),
        'h3': ParagraphStyle('H3', parent=body, fontName='GuideBold', fontSize=13, leading=17, spaceBefore=12, spaceAfter=8, keepWithNext=True),
        'step': ParagraphStyle('Step', parent=body, fontName='GuideBold', fontSize=19, leading=24, textColor=colors.HexColor(ACCENT), spaceAfter=16, keepWithNext=True),
        'toc': ParagraphStyle('TOC', parent=body, fontSize=10.2, leading=16.8, spaceAfter=5),
        'small': ParagraphStyle('Small', parent=body, fontSize=8.7, leading=11.8, spaceAfter=4),
        'table': ParagraphStyle('Table', parent=body, fontSize=8.2, leading=11, spaceAfter=0),
        'quote': ParagraphStyle('Quote', parent=body, leftIndent=14, borderColor=colors.HexColor('#e0ccd2'), borderWidth=1, borderPadding=9, backColor=colors.HexColor('#faf6f7'), spaceBefore=6, spaceAfter=10),
        'code': ParagraphStyle('Code', parent=body, fontName='Courier', fontSize=8, leading=11, leftIndent=10, rightIndent=10, backColor=colors.HexColor('#f3f5f8'), borderPadding=8, spaceBefore=7, spaceAfter=10),
    }


def build(output):
    register_fonts()
    text = SOURCE.read_text(encoding='utf-8')
    lines = text.splitlines()
    styles = make_styles()
    doc = GuideDoc(output)
    story = []
    sections = re.findall(r'^## (.+)$', text, re.M)
    steps = re.findall(r'^### (Step \d\d: .+)$', text, re.M)
    story.extend([
        Spacer(1, 80), Paragraph('Codex of Heroes', styles['title']),
        Paragraph('Project history<br/>and learning guide', styles['h2']),
        Spacer(1, 20), Paragraph('25 development stages: what changed, in what order, and why.', styles['body']),
        Paragraph('Prepared for you, Sir - 19 October 2026', styles['body']),
        Spacer(1, 28), Paragraph('Reading copy with clickable contents and PDF bookmarks.', styles['body']),
        Paragraph('The editable Markdown source remains in the repository. Individual steps begin on separate pages so we can return to them for focused lessons.', styles['body']),
        PageBreak(), Paragraph('Contents', styles['h2']),
        Paragraph('Click a section title, or open your PDF reader\'s bookmarks panel.', styles['body']),
    ])
    for title in sections:
        if title != 'Contents':
            story.append(Paragraph(f'<link href="#{slug(title)}" color="{ACCENT}">{html.escape(clean(title))}</link>', styles['toc']))
    story.extend([PageBreak(), Paragraph('The 25 development steps', styles['h2'])])
    for title in steps:
        story.append(Paragraph(f'<link href="#{slug(title)}" color="{ACCENT}">{html.escape(clean(title))}</link>', styles['toc']))
    story.append(PageBreak())

    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('# '):
            i += 1
            if i < len(lines) and not lines[i].strip(): i += 1
            if i < len(lines) and lines[i].startswith('**Prepared'): i += 1
            continue
        if line == '## Contents':
            i += 1
            while i < len(lines) and not lines[i].startswith('## '): i += 1
            continue
        if (heading := re.match(r'^(#{2,3}) (.+)$', line)):
            depth, title = len(heading[1]), heading[2]
            is_step = bool(re.match(r'Step \d\d:', title))
            if is_step and not title.startswith('Step 01:') or depth == 2 and title != 'How to use this guide':
                story.append(PageBreak())
            else:
                story.append(CondPageBreak(95))
            paragraph = Paragraph(inline(title), styles['step' if is_step else 'h2' if depth == 2 else 'h3'])
            paragraph.guide_anchor = (slug(title), title, 0 if depth == 2 else 1)
            story.append(paragraph)
            i += 1
            continue
        if line.startswith('```'):
            language = line[3:].strip()
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i]); i += 1
            i += 1
            if language == 'mermaid':
                story.append(Diagram('architecture' if code and code[0].startswith('flowchart') else 'sequence', doc.width))
            else:
                story.append(Paragraph('<br/>'.join(html.escape(clean(v)) for v in code), styles['code']))
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [v.strip() for v in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                    rows.append([Paragraph(inline(cell), styles['table']) for cell in cells])
                i += 1
            count = len(rows[0])
            if count == 4: widths = [doc.width * value for value in (.12, .22, .14, .52)]
            elif count == 3: widths = [doc.width * value for value in (.23, .39, .38)]
            else: widths = [doc.width * .26, doc.width * .74]
            table = Table(rows, colWidths=widths, repeatRows=1, hAlign=TA_LEFT)
            padding = 4 if rows[0][0].getPlainText() == 'Topic' else 7
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9edf3')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fb')]),
                ('LINEBELOW', (0, 0), (-1, 0), .6, colors.HexColor('#c9d0db')),
                ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ('TOPPADDING', (0, 0), (-1, -1), padding), ('BOTTOMPADDING', (0, 0), (-1, -1), padding),
            ]))
            story.extend([table, Spacer(1, 12)])
            continue
        if line.startswith('> '):
            parts = []
            while i < len(lines) and lines[i].startswith('> '):
                parts.append(lines[i][2:]); i += 1
            story.append(Paragraph(inline(' '.join(parts)), styles['quote']))
            continue
        if re.match(r'^(?:- |\d+\. )', line):
            prefix = '- ' if line.startswith('- ') else re.match(r'\d+\. ', line)[0]
            parts = [line[len(prefix):]]
            i += 1
            while i < len(lines) and lines[i].startswith('  ') and lines[i].strip():
                parts.append(lines[i].strip()); i += 1
            story.append(Paragraph(html.escape(prefix) + inline(' '.join(parts)), styles['body']))
            continue
        parts = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#|\||```|> |<a |\d+\. |- )', lines[i]):
            parts.append(lines[i]); i += 1
        story.append(Paragraph(inline(' '.join(parts)), styles['body']))
    output.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/pdf/PROJECT_HISTORY_AND_LEARNING_GUIDE.pdf')
    arguments = parser.parse_args()
    build(arguments.output.resolve())
    print(arguments.output.resolve())
