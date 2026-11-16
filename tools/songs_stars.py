"""
十二星座主题曲（gen-songs.py 读取）。只用西洋原声乐器；旋律为手写简谱。
调式：大调（major）、小调（minor）、多利亚（dorian）、混合利底亚（mixo）、利底亚（lydian，4 为升四级）。
"""

SONGS = [
    dict(id='stars_aries', title='冲呀小羊', key='D', mode='major', meter='4/4', bpm=116, seed=601,
         lead='flute', lead2='violin', counter='clarinet', harm='violin',
         comp=dict(kind='strum', inst='steel', vel=0.3),
         bass='upright', pad='strings', perc=['shaker', 'kick'],
         A='1 3 5 - 5 6 5 3 | 4 - 6 - 5 - - - | 3 5 1\' - 1\' 2\' 1\' 7 | 6 - - - 5 - - - |'
           '1 3 5 - 5 6 5 3 | 4 - 6 - 1\' - 7 6 | 5 - 2 3 4 3 2 7, | 1 - - - - - 0 0',
         B='6 - 6 7 1\' - 6 - | 5 - 5 6 5 - 3 - | 4 - 4 5 6 5 4 3 | 2 - - - 5 - - -'),

    dict(id='stars_taurus', title='慢慢品尝', key='Eb', mode='major', meter='4/4', bpm=74, seed=602, swing=0.62, seventh=True,
         lead='vibes', lead2='piano', counter='clarinet', harm='piano',
         comp=dict(kind='block', inst='piano', hits={'4/4': [0, 3, 6]}, vel=0.28),
         bass='upright', walk=True, pad=None, perc=['brush'], space=1.2,
         A='5 - 3 - 4 3 2 - | 1 2 3 5 3 - - - | 6 - 5 - 4 3 4 - | 5 - - - 0 0 2 3 |'
           '5 - 3 - 4 3 2 1 | 6, - 1 - 2 - 3 - | 4 - 3 2 7, - 2 - | 1 - - - - - 0 0',
         B='1\' - 7 6 5 - - - | 6 - 5 4 3 - - - | 4 5 6 - 7 6 5 4 | 5 - - - - - 0 0'),

    dict(id='stars_gemini', title='镜子里的我', key='G', mode='major', meter='4/4', bpm=104, seed=603,
         lead='marimba', lead2='vibes', counter='glock', harm='vibes',
         comp=dict(kind='arp', inst='harp', pattern=[0, 2, 1, 3, 2, 4, 3, 2], vel=0.3),
         bass='upright', pad=None, perc=['shaker'],
         A='1 2 3 0 3 4 5 0 | 5 4 3 2 1 - - - | 3 4 5 0 5 6 7 0 | 1\' 7 6 5 5 - - - |'
           '6 5 4 0 4 3 2 0 | 5 4 3 0 3 2 1 0 | 2 3 4 3 2 - 7, - | 1 - - - 0 0 0 0',
         B='5 - 3 - 6 - 4 - | 7 - 5 - 1\' - - - | 6 5 6 5 4 3 4 3 | 2 - - - - - 0 0'),

    dict(id='stars_cancer', title='沙滩上的家', key='E', mode='major', meter='6/8', bpm=66, seed=604,
         lead='clarinet', lead2='flute', counter='cello', harm='flute',
         comp=dict(kind='arp', inst='harp', pattern=[0, 1, 2, 3, 2, 1], vel=0.35),
         bass='cello', pad='strings', pad_always=True, perc=[], amb='waves', space=1.5,
         A='3 - 4 5 - 3 | 2 - 1 2 - - | 3 - 5 1\' - 7 | 6 - - 5 - - |'
           '4 - 5 6 - 4 | 3 - 2 1 - 6, | 7, - 1 2 - 7, | 1 - - - - -',
         B='5 - 6 7 - 1\' | 2\' - 1\' 7 - 5 | 6 - 5 4 - 3 | 2 - - - - -'),

    dict(id='stars_leo', title='小小国王', key='C', mode='major', meter='4/4', bpm=92, seed=605,
         lead='violin', lead2='flute', counter='cello', harm='violin',
         comp=dict(kind='block', inst='piano', hits={'4/4': [0, 2, 4, 6]}, vel=0.24),
         bass='cello', pad='strings', pad_always=True, perc=['kick', 'triangle'], space=1.5,
         A='1. 1_ 5 - - - 4 3 | 2. 3_ 4 - 3 - - - | 3. 3_ 6 - - - 5 4 | 3 - - - 2 - - - |'
           '1. 1_ 5 - - 6 5 4 | 3. 4_ 5 - 1\' - - - | 6 - 5 - 4 3 2 7, | 1 - - - - - 0 0',
         B='6. 6_ 1\' - - - 7 6 | 5. 6_ 5 - 3 - - - | 4. 4_ 6 - 5 4 3 2 | 5 - - - - - 0 0'),

    dict(id='stars_virgo', title='麦田里的诗', key='D', mode='dorian', meter='4/4', bpm=88, seed=606,
         lead='guitar', lead2='flute', counter='clarinet', harm='flute',
         comp=dict(kind='arp', inst='harp', pattern=[0, 1, 2, 3, 4, 3, 2, 1], vel=0.3),
         bass='cello', pad='strings', perc=[], amb='birds',
         A='1 - 2 3 5 - 4 3 | 2 - 1 2 4 - - - | 5 - 4 5 7 - 6 5 | 4 - - - 3 - - - |'
           '1 - 2 3 5 - 6 7 | 1\' - 7 5 4 - 3 - | 2 - 3 4 3 2 7, - | 1 - - - - - 0 0',
         B='5 - 5 4 3 - 4 5 | 7 - 6 5 4 - - - | 3 - 4 5 4 3 2 3 | 1 - - - 7, - - -'),

    dict(id='stars_libra', title='平衡木', key='Bb', mode='major', meter='3/4', bpm=104, seed=607,
         lead='celesta', lead2='flute', counter='clarinet', harm='glock',
         comp=dict(kind='oompah', inst='harp', vel=0.4),
         bass=None, pad='strings', perc=['triangle'], space=1.4,
         A='1 - 3 5 - 3 | 4 - 6 5 - - | 5 - 3 1 - 3 | 2 - - - - - |'
           '6 - 4 2 - 4 | 5 - 3 1 - 3 | 2 - 4 7, - 2 | 1 - - - - -',
         B='3 4 5 6 - 5 | 4 3 2 3 - - | 6 5 4 3 - 2 | 5 - - - - -'),

    dict(id='stars_scorpio', title='夜色秘密', key='D', mode='minor', meter='4/4', bpm=84, seed=608,
         lead='cello', lead2='clarinet', counter='piano', harm='clarinet',
         comp=dict(kind='arp', inst='piano', pattern=[0, 1, 2, 1, 3, 1, 2, 1], vel=0.3),
         bass='upright', pad='strings', pad_always=True, perc=['kick'], space=1.6,
         A='1 - 5 - 4 3 2 3 | 1 - 7, - 6, - - - | 1 - 5 - 6 5 4 5 | 3 - - - 0 0 0 0 |'
           '6 - 5 - 4 3 2 3 | 4 - 3 - 2 1 7, 1 | 2 3 4 3 2 - 7, - | 1 - - - - - 0 0',
         B='3 - 4 5 - 6 5 4 | 3 - 2 1 - - - - | 6, - 7, 1 - 2 3 4 | 5 - - - - - 0 0'),

    dict(id='stars_sagittarius', title='一支箭', key='G', mode='mixo', meter='4/4', bpm=120, seed=609,
         lead='steel', lead2='violin', counter='flute', harm='violin',
         comp=dict(kind='strum', inst='guitar', vel=0.3),
         bass='upright', pad=None, perc=['shaker', 'kick'],
         A='1 3 5 1\' - - 7 - | 6 5 4 5 - - - - | 2 4 6 2\' - - 1\' - | 7 6 5 6 5 - - - |'
           '1 3 5 1\' - 2\' 3\' - | 2\' 1\' 7 5 6 - - - | 4 5 6 5 4 2 7, 2 | 1 - - - - - 0 0',
         B='6 - 7 1\' 2\' - - - | 1\' 7 6 7 5 - - - | 4 - 6 5 4 - 2 - | 5 - - - - - 0 0'),

    dict(id='stars_capricorn', title='爬山的星星', key='E', mode='dorian', meter='4/4', bpm=96, seed=610,
         lead='piano', lead2='cello', counter='flute', harm='clarinet',
         comp=dict(kind='arp', inst='piano', pattern=[0, 1, 2, 1], vel=0.26),
         bass='upright', pad='strings', perc=['brush'],
         A='1 2 3 - 2 3 4 - | 3 4 5 - 4 - - - | 5 6 7 - 6 7 1\' - | 7 - 5 - 6 - - - |'
           '1\' - 7 6 5 - 4 3 | 4 - 3 2 1 - - - | 2 3 4 5 4 3 2 7, | 1 - - - - - 0 0',
         B='5 - 5 - 6 5 4 5 | 7 - 6 - 5 - - - | 3 4 5 6 7 - 6 5 | 4 - - - 5 - - -'),

    dict(id='stars_aquarius', title='倒一杯星光', key='F', mode='lydian', meter='4/4', bpm=70, seed=611,
         lead='harp', lead2='flute', counter='celesta', harm='flute',
         comp=dict(kind='arp', inst='celesta', pattern=[0, 2, 4, 5, 4, 2], vel=0.22),
         bass='cello', pad='strings', pad_always=True, perc=[], space=1.8,
         A='5 - - 4 3 - 2 3 | 4 - - - 3 - - - | 6 - - 5 4 - 3 4 | 5 - - - - - 0 0 |'
           '1\' - 7 - 5 - 4 - | 3 - 4 5 2 - - - | 3 - 4 - 7, - 2 - | 1 - - - - - 0 0',
         B='7 - 1\' - 2\' - 7 - | 5 - - - 4 - - - | 6 - 5 4 3 - 4 2 | 5 - - - - - 0 0'),

    dict(id='stars_pisces', title='两条小鱼', key='A', mode='major', meter='3/4', bpm=92, seed=612,
         lead='flute', lead2='clarinet', counter='cello', harm='clarinet',
         comp=dict(kind='arp', inst='harp', pattern=[0, 1, 2, 3, 2, 1], vel=0.32),
         bass='cello', pad='strings', perc=[], amb='waves', space=1.4,
         A='3 4 5 - 4 3 | 2 3 4 - 3 2 | 1 2 3 - 5 4 | 3 - - - - - |'
           '5 6 7 - 6 5 | 4 5 6 - 5 4 | 3 4 2 - 7, 2 | 1 - - - - -',
         B='1\' - 7 6 - 5 | 6 - 5 4 - 3 | 4 - 3 2 - 3 | 5 - - - - -'),
]
