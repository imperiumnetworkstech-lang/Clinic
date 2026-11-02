"""Extract structured content from the saved pages in content/raw into content/clinic.json."""
import html
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
raw = root / "content" / "raw"
CLIENT = "[[CLIENT TO PROVIDE: {}]]"


def read(name):
    return (raw / f"{name}.html").read_text(encoding="utf-8", errors="replace")


def clean(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"[ \t]+", " ", s).strip()


# Obvious typos on the legacy site, corrected wherever the text is reused. Meaning is unchanged.
TYPO_FIXES = {
    "theesthetics(shape, spacing, color)": "the aesthetics (shape, spacing, colour)",
    "Assissted": "Assisted",
    "apperance": "appearance",
    "size,shape,color": "size, shape, colour",
    "Peridontal": "Periodontal",
    "patient’s feel": "patients feel",
    " we provide solutions": " We provide solutions",
    "deskulates": "stimulates",
}


def copyedit(s):
    for wrong, right in TYPO_FIXES.items():
        s = s.replace(wrong, right)
    return s


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---------- FAQs ----------
faq_html = read("faq")
faqs = []
for m in re.finditer(
    r'<i class="fa fa-angle-double-down"[^>]*></i>(.*?)</a>.*?<div class="row acc-text">(.*?)</div>',
    faq_html, re.S):
    body = m.group(2)
    paras = [clean(p) for p in re.findall(r"<p>(.*?)</p>", body, re.S)]
    lis = [clean(li) for li in re.findall(r"<li>(.*?)</li>", body, re.S)]
    faqs.append({
        "question": clean(m.group(1)),
        "answerParagraphs": [copyedit(p) for p in paras if p],
        "answerList": lis,
        "sourceUrl": "https://expressionsdentalclinic.com/faq",
        "flags": ["generic-boilerplate-likely-duplicate", "needs-doctor-review"],
    })

# ---------- Treatments ----------
categories = [
    ("general-treatments", "service-1", "/service/view/1"),
    ("advanced-treatments", "service-2", "/service/view/2"),
    ("cosmetic-treatments", "service-19", "/service/view/19"),
]
svc_index = read("service")
cat_intros = {}
for m in re.finditer(r"<h4>(.*?)</h4>\s*<p>(.*?)</p>", svc_index, re.S):
    cat_intros[clean(m.group(1))] = clean(m.group(2))

treatment_categories = []
treatments = []
for cat_slug, page, old in categories:
    h = read(page)
    title = clean(re.search(r'<div class="service-heading mb_20">\s*<h3>(.*?)</h3>', h, re.S).group(1))
    text = re.search(r'<div class="service-heading mb_20">.*?<div class="text">(.*?)</div>', h, re.S).group(1)
    items = re.findall(r"<p><b>(.*?)</b></p>\s*<p>(.*?)</p>", text, re.S)
    treatment_categories.append({
        "slug": cat_slug,
        "name": title,
        "intro": copyedit(cat_intros.get(title, "")),
        "legacyUrl": f"https://expressionsdentalclinic.com{old}",
    })
    for name, desc in items:
        name = clean(name)
        treatments.append({
            "slug": slug(name),
            "name": name,
            "category": cat_slug,
            "shortDescription": copyedit(clean(desc)),
            "benefits": CLIENT.format(f"benefits of {name}"),
            "procedureSteps": CLIENT.format(f"procedure steps for {name}"),
            "duration": CLIENT.format(f"typical duration / number of sittings for {name}"),
            "recovery": CLIENT.format(f"recovery / aftercare for {name}"),
            "price": None,
            "faqs": [],
            "sourceUrl": f"https://expressionsdentalclinic.com{old}",
            "status": "published-on-legacy-site",
        })

# ---------- Blog ----------
posts = []
for page, old in [("news-6", "/news/view/6"), ("news-4", "/news/view/4"), ("news-2", "/news/view/2")]:
    h = read(page)
    title = clean(re.search(r'<div class="heading-text news-details">\s*<h3>(.*?)</h3>', h, re.S).group(1))
    date = clean(re.search(r'\|\s*<span class="by-admin"><strong>(.*?)</strong>', h, re.S).group(1))
    cat = clean(re.search(r'<a href="[^"]*/category/\d+">(.*?)</a>', h, re.S).group(1))
    img = re.search(r'<div class="photo">\s*<img src="([^"]+)"', h, re.S).group(1)
    body = re.search(r'<div class="text mt_20">(.*?)</div>', h, re.S).group(1)
    excerpt = re.search(r'<meta property="og:description" content="([^"]*)"', h)
    posts.append({
        "slug": slug(title),
        "title": title,
        "publishedDate": date,
        "category": cat,
        "author": CLIENT.format("author / reviewing doctor"),
        "excerpt": html.unescape(excerpt.group(1)) if excerpt else "",
        "image": "/images/original/" + img.rsplit("/", 1)[-1],
        "bodyHtml": re.sub(r"\s+", " ", body).strip(),
        "legacyUrl": f"https://expressionsdentalclinic.com{old}",
        "flags": ["likely-duplicate-of-third-party-content", "needs-doctor-review", "image-low-res"],
    })

# ---------- Testimonials ----------
home = read("home")
testimonials = []
seen = set()
for m in re.finditer(r'<div class="testi_content">.*?<p>(.*?)</p>.*?<div class="testi_name">(.*?)</div>\s*<div class="testi_designation">(.*?)</div>', home, re.S):
    quote = clean(m.group(1))
    if quote in seen:
        continue
    seen.add(quote)
    testimonials.append({"quote": quote, "name": clean(m.group(2)), "location": clean(m.group(3)),
                         "rating": None, "source": "legacy website (date and consent unknown)",
                         "sourceUrl": "https://expressionsdentalclinic.com/"})

data = json.loads((root / "content" / "clinic.base.json").read_text(encoding="utf-8"))
data["treatmentCategories"] = treatment_categories
data["treatments"] = treatments
data["faqs"] = faqs
data["blogPosts"] = posts
data["testimonials"] = testimonials
(root / "content" / "clinic.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(len(treatments), "treatments", len(faqs), "faqs", len(posts), "posts", len(testimonials), "testimonials")
