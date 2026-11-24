import json, csv, sys, collections as C
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
rows = json.load(open(sys.argv[1])); outdir = sys.argv[2]
TRACK = {'C':'Categorical','P':'Preliminary','A':'Advanced','R':'Physician (Reserved)','M':'Primary'}
cols = ['Specialty','Program Name','City','State','Location','Track Type','Program Status','Status Description',
        'How to Apply - MRM','How to Apply - SOAP','NRMP Code','ACGME Code','NRMP Directory URL']
out = []
for r in rows:
    a = r['_apply']
    out.append([r['specialty'], r['program_name'], r['city'], r['state'], r['location'],
        TRACK.get(r['nrmp_code'][7], r['nrmp_code'][7]), r['program_status'], r['status_description'],
        a.get('MRM','Not listed'), a.get('SOAP','Not listed'), r['nrmp_code'], r['acgme_code'], r['url']])
out.sort(key=lambda x: (x[0], x[3], x[2].lower(), x[1], x[10]))
with open(f'{outdir}/nrmp_main_match_programs.csv','w',newline='',encoding='utf-8-sig') as f:
    w = csv.writer(f); w.writerow(cols); w.writerows(out)
wb = Workbook(); ws = wb.active; ws.title = 'All Programs'
ws.append(cols)
for row in out: ws.append(row)
hdr = PatternFill('solid', fgColor='14678F')
for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
widths = [34,40,20,18,30,20,16,50,22,22,13,13,60]
for i,wd in enumerate(widths,1): ws.column_dimensions[get_column_letter(i)].width = wd
for row in ws.iter_rows(min_row=2):
    row[10].number_format = '@'; row[11].number_format = '@'
    st = row[6].value
    if st != 'Active': row[6].font = Font(color={'Withdrawn':'C00000','Not Participating':'7F7F7F','Initial':'B8860B'}[st], bold=True)
ws.freeze_panes = 'C2'; ws.auto_filter.ref = ws.dimensions
# Summary by specialty
s = wb.create_sheet('By Specialty')
statuses = ['Active','Initial','Withdrawn','Not Participating']
s.append(['Specialty','Total']+statuses+['MRM via ERAS','MRM via ResidencyCAS'])
by = C.defaultdict(list)
for r in out: by[r[0]].append(r)
for sp in sorted(by, key=lambda k:-len(by[k])):
    L = by[sp]
    s.append([sp,len(L)]+[sum(1 for r in L if r[6]==x) for x in statuses]+
             [sum(1 for r in L if 'ERAS' in r[8]), sum(1 for r in L if 'ResidencyCAS' in r[8])])
s.append(['TOTAL',len(out)]+[sum(1 for r in out if r[6]==x) for x in statuses]+
         [sum(1 for r in out if 'ERAS' in r[8]), sum(1 for r in out if 'ResidencyCAS' in r[8])])
for c in s[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hdr
for c in s[s.max_row]: c.font = Font(bold=True)
s.column_dimensions['A'].width = 44
for i in range(2,9): s.column_dimensions[get_column_letter(i)].width = 16
s.freeze_panes = 'B2'
# By state
t = wb.create_sheet('By State'); t.append(['State','Programs','Active'])
for st,n in C.Counter(r[3] for r in out).most_common(): t.append([st,n,sum(1 for r in out if r[3]==st and r[6]=='Active')])
for c in t[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hdr
t.column_dimensions['A'].width = 24
# Legend
g = wb.create_sheet('Legend')
for line in [
 ['Field','Meaning'],
 ['Source','NRMP Main Residency Match Program Directory (programdirectory.nrmp.org), saved page provided by user; 7,492 program tracks'],
 ['Program Status: Active','The program track is participating in the Match.'],
 ['Program Status: Initial','The program track has not yet been activated for participation in the Match.'],
 ['Program Status: Withdrawn','The program track was previously Active but has been withdrawn from the Match and will not participate.'],
 ['Program Status: Not Participating','The program track will not participate in the Match.'],
 ['How to Apply - MRM','Application service for the Main Residency Match (ERAS, ResidencyCAS, or Other)'],
 ['How to Apply - SOAP','Application service for the Supplemental Offer and Acceptance Program'],
 ['Not listed','Directory showed no "How to apply" section for this track (14 tracks)'],
 ['Track Type','Derived from the 8th character of the NRMP code: C=Categorical, P=Preliminary, A=Advanced, R=Physician (Reserved), M=Primary. Not a field shown in the directory itself.'],
 ['ACGME Code','10-digit ACGME program ID. Several NRMP tracks (e.g. categorical + preliminary) can share one ACGME program.'],
]: g.append(line)
for c in g[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = hdr
g.column_dimensions['A'].width = 34; g.column_dimensions['B'].width = 120
wb.save(f'{outdir}/nrmp_main_match_programs.xlsx')
print(len(out))
