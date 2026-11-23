import sys, json, re
from bs4 import BeautifulSoup
html = open(sys.argv[1], encoding='utf-8').read()
soup = BeautifulSoup(html, 'lxml')
arts = soup.select('#results article.result')
rows = []
def t(el): return ' '.join(el.get_text(' ', strip=True).split()) if el else ''
for a in arts:
    r = {}
    r['specialty'] = t(a.select_one('.result__badge'))
    loc = t(a.select_one('address'))
    r['location'] = loc
    city, _, state = loc.rpartition(',')
    r['city'] = city.strip(); r['state'] = state.strip()
    r['program_name'] = t(a.select_one('h3'))
    btn = a.select_one('.tooltip__container button.tooltip')
    r['program_status'] = t(btn) if btn else ''
    msg = a.select_one('.tooltip__message')
    r['status_description'] = t(msg)
    apply = {}
    for li in a.select('.result__apply li'):
        tag = li.select_one('.result__tag')
        k = t(tag); full = t(li)
        apply[k] = full[len(k):].strip() if full.startswith(k) else full
    r['_apply'] = apply
    codes = {}
    for li in a.select('footer ul li'):
        sp = li.find_all('span')
        if len(sp) >= 2: codes[t(sp[0])] = t(sp[1])
    r['nrmp_code'] = codes.get('NRMP code', '')
    r['acgme_code'] = codes.get('ACGME code', '')
    link = a.select_one('footer a[href]')
    r['url'] = link['href'] if link else ''
    r['_codes'] = codes
    rows.append(r)
json.dump(rows, open(sys.argv[2], 'w'), indent=0)
print(len(arts))
