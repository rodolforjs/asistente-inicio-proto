import json,re
base='/Users/rodolfoduemint/Projects/creado-en-chile-clone/data/'
im=open(base+'images.js').read(); m=json.loads(im[im.index('=')+1:].rstrip().rstrip(';'))
pick={'mama':'mama-cual-es-tu-historia','abuelo':'abuelo-cual-es-tu-historia','panera':'panera-cetaceos','biobio':'set-bio-bio','pinchos':'set-pinchos-cachapoal','cojin':'funda-cojin-picaflor','spray':'home-spray-rauli','toalla':'set-toalla-bandurria-chucao-martin-pescador-cometocino-picaflor','mudador':'mudador-portatil-pinguino-papua'}
def url(spec,w=400):
    kind,*rest=spec.split('/'); p,_,qs=('/'.join(rest)).partition('?')
    sized=re.sub(r'(\.\w+)$',lambda x:f'_{w}x'+x.group(1),p)
    return f"https://cdn.shopify.com/s/files/1/1481/4916/{'files' if kind=='f' else 'products'}/{sized}"+(f'?{qs}' if qs else '')
P={k:url(m[h]) for k,h in pick.items()}
open('index.html','w').write(open('template.html').read().replace('/*PRODUCTS*/',json.dumps(P)))
