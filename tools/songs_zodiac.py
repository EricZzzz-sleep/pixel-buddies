"""
十二生肖主题曲（gen-songs.py 读取）。只用中国乐器；旋律为手写简谱，均为五声音阶：
宫调式（major：1 2 3 5 6）、商调式（dorian：1 2 4 5 7）、徵调式（mixo：1 2 4 5 6）、羽调式（minor：1 3 4 5 7）。
"""

SONGS = [
    dict(id='zodiac_rat', title='数铜钱', key='D', mode='major', meter='4/4', bpm=104, seed=501,
         lead='yangqin', lead2='dizi', counter='xiao', harm='zheng',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 1, 2, 3, 2, 1, 2, 1], vel=0.4),
         bass='ruan', pad='sheng', perc=['muyu', 'pengling'],
         A='1 1 2 3 5 - 3 - | 6 5 3 5 2 - - - | 3 3 5 6 1\' - 6 5 | 3 5 6 5 ~3 - - - |'
           '1 1 2 3 5 - 6 - | 1\' 6 5 3 2 - 3 5 | 6 - 5 3 2 3 5 2 | 1 - - - 0 0 0 0',
         B='5 5 6 1\' 2\' - 1\' 6 | 5 - 6 5 ~3 - 2 - | 3 5 6 6 5 3 2 3 | 5 - - - 5 6 5 3'),

    dict(id='zodiac_ox', title='田埂慢歌', key='F', mode='mixo', meter='4/4', bpm=72, seed=502,
         lead='xiao', lead2='zheng', counter='erhu', harm='zheng',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 1, 2, 1], vel=0.32),
         bass='ruan', pad='sheng', pad_always=True, perc=[], amb='birds', space=1.5,
         A='1 - 2 4 ~5 - - - | 6 5 4 2 4 - - - | 5 - 6 1\' 6 5 4 5 | 2 - - - 0 0 1 2 |'
           '4 - 5 6 5 4 2 4 | ~5 - - 4 2 - 1 2 | 4 2 1 6, 1 - 2 - | 1 - - - - - 0 0',
         B='6 - 1\' - 2\' 1\' 6 5 | 4 - 5 6 ~5 - - - | 6 1\' 6 5 4 2 4 5 | 2 - - - - - 0 0'),

    dict(id='zodiac_tiger', title='竹林巡山', key='A', mode='minor', meter='4/4', bpm=108, seed=503,
         lead='dizi', lead2='pipa', counter='xiao', harm='zheng',
         comp=dict(kind='arp', inst='ruan', pattern=[0, 0, 1, 0, 2, 1, 0, 1], vel=0.45),
         bass='ruan', pad='sheng', perc=['tanggu', 'muyu'], amb='birds',
         A='1. 1_ 3 1 5 - 4 3 | 4. 3_ 1 7, 1 - - - | 3. 3_ 5 3 7 - 5 4 | 3 - - - 0 4 3 1 |'
           '1. 1_ 3 1 5 - 7 5 | 1\' - 7 5 4 - 3 4 | 5 3 4 3 1 7, 5, 7, | 1 - - - 0 0 0 0',
         B='5 - 5 7 ~1\' - 7 5 | 4 5 4 3 1 - - - | 3 - 3 4 5 7 5 4 | 3 - - - 5, - 7, -'),

    dict(id='zodiac_rabbit', title='月饼与月亮', key='Eb', mode='major', meter='3/4', bpm=80, seed=504,
         lead='zheng', lead2='xiao', counter='xiao', harm='yangqin',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 1, 2, 3, 2, 1], vel=0.3),
         bass='ruan', pad='sheng', pad_always=True, perc=['pengling'], space=1.6,
         A='3 - - 5 6 5 | 3 - - 2 1 2 | 3 - 5 1\' 6 5 | ~6 - - - - - |'
           '5 - - 6 1\' 6 | 5 - 3 2 - 1 | 2 - 3 5 3 2 | 1 - - - - -',
         B='6 - 1\' 2\' - 1\' | ~6 - - 5 - - | 3 - 5 6 5 3 | 2 - - - - -'),

    dict(id='zodiac_dragon', title='云上龙珠', key='E', mode='dorian', meter='4/4', bpm=92, seed=505,
         lead='pipa', lead2='dizi', counter='erhu', harm='yangqin',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 2, 1, 3, 2, 4, 3, 2], vel=0.38),
         bass='ruan', pad='sheng', pad_always=True, perc=['tanggu'], space=1.5,
         A='1 - 5 - 4 5 7 5 | 4 - 2 - 1 - - - | 2 4 5 - 7 - 1\' 7 | 5 - - - - - 0 0 |'
           '~1\' - 7 5 4 - 5 - | 7 5 4 2 4 - - - | 2 - 4 5 4 2 1 7, | 1 - - - - - - -',
         B='5 - 7 1\' 2\' - 1\' - | 7 - 5 - ~4 - - - | 5 7 5 4 2 4 5 7 | 5 - - - 4 - 2 -'),

    dict(id='zodiac_snake', title='花间午睡', key='G', mode='minor', meter='4/4', bpm=80, seed=506,
         lead='erhu', lead2='xiao', counter='zheng', harm='zheng',
         comp=dict(kind='block', inst='ruan', hits={'4/4': [0, 3, 6]}, vel=0.3),
         bass='ruan', pad='sheng', perc=['muyu'], space=1.4,
         A='0 5 4 3 4 - 1 - | 3 - 4 3_ 1_ 7, - - - | 0 5 7 5 1\' - 7 5 | 4 - - - 3 - - - |'
           '0 5 4 3 4 - 5 7 | 1\' - 7 5_ 4_ 5 - - - | 4 3 1 3 4 - 3 7, | 1 - - - - - 0 0',
         B='3 4 5 - 7 5 4 3 | 4 - - 5 3 - - - | 3 4 5 - 1\' 7 5 4 | 5 - - - - - 0 0'),

    dict(id='zodiac_horse', title='马蹄轻轻', key='C', mode='major', meter='6/8', bpm=100, seed=507,
         lead='erhu', lead2='yangqin', counter='dizi', harm='zheng',
         comp=dict(kind='arp', inst='yangqin', pattern=[0, 2, 1, 3, 2, 1], vel=0.35),
         bass='ruan', pad='sheng', perc=['tanggu'],
         A='1 - 2 3 - 5 | 6 - 5 3 - - | 5 - 6 1\' - 6 | 5 - - 0 0 0 |'
           '3 - 5 6 - 1\' | 2\' - 1\' 6 - 5 | 3 - 2 1 - 2 | 1 - - - - -',
         B='5 5 5 6 - 5 | 3 - 5 2 - - | 1 1 1 2 - 3 | 5 - - 6 - 5'),

    dict(id='zodiac_goat', title='云朵牧场', key='F', mode='mixo', meter='3/4', bpm=100, seed=508,
         lead='dizi', lead2='yangqin', counter='xiao', harm='zheng',
         comp=dict(kind='oompah', inst='ruan', vel=0.42),
         bass=None, pad='sheng', perc=['pengling'], amb='birds',
         A='5 - 6 5 4 2 | 4 - - 2 - 1 | 2 4 5 6 - 5 | 4 - - - - - |'
           '5 - 6 1\' - 6 | 5 - 4 2 - 4 | 5 4 2 1 - 6, | 1 - - - - -',
         B='1\' - 6 5 - 6 | 1\' - 2\' 1\' - - | 6 5 4 5 - 6 | 5 - - - - -'),

    dict(id='zodiac_monkey', title='偷桃记', key='G', mode='major', meter='4/4', bpm=118, seed=509,
         lead='pipa', lead2='dizi', counter='xiao', harm='yangqin',
         comp=dict(kind='block', inst='yangqin', hits={'4/4': [1, 3, 5, 7]}, vel=0.25),
         bass='ruan', pad=None, perc=['muyu', 'tanggu'],
         A='5 0 5 0 1\' 0 3 0 | 2 3 5 0 6, - - - | 5 0 5 0 2\' 0 6 0 | 5 - 1\' - 6 - - - |'
           '3\' 0 2\' 0 1\' 6 5 0 | 6 1\' 2\' 3\' 2\' - 1\' 6 | 5 3 6 5 2 3 6, 2 | 1 - 0 0 1\' - 0 0',
         B='3 3 0 5 6 6 0 1\' | 2\' 2\' 0 1\' 6 - 5 - | 3 5 3 2 1 6, 1 2 | 3 - - - 5, - - -'),

    dict(id='zodiac_rooster', title='第一声早安', key='A', mode='mixo', meter='4/4', bpm=100, seed=510,
         lead='yangqin', lead2='dizi', counter='xiao', harm='zheng',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 1, 2, 3, 4, 3, 2, 1], vel=0.32),
         bass='ruan', pad='sheng', perc=['pengling', 'muyu'], amb='birds',
         A='5, 1 - 2 4 - 5 - | 6 5 4 - 2 - - - | 5, 1 - 2 4 5 6 1\' | 5 - - - - - 0 0 |'
           '1\' - 6 5 6 - 5 4 | 5 - 4 2 1 - - 2 | 4 - 2 1 6, - 5, - | 1 - - - - - - -',
         B='4 4 5 6 ~1\' - - - | 2\' 1\' 6 5 6 - - - | 4 5 6 5 4 2 1 2 | 4 - - - 5 - - -'),

    dict(id='zodiac_dog', title='红围巾', key='Bb', mode='major', meter='4/4', bpm=76, seed=511,
         lead='xiao', lead2='zheng', counter='erhu', harm='zheng',
         comp=dict(kind='arp', inst='zheng', pattern=[0, 1, 2, 3, 2, 1, 2, 3], vel=0.3),
         bass='ruan', pad='sheng', pad_always=True, perc=[], space=1.4,
         A='6 - 5 - 3 5 6 - | 1\' 6 5 3 ~5 - - - | 2 3 5 - 3 2 1 - | 2 - - - - - 0 0 |'
           '6 - 5 - 3 5 6 1\' | 2\' - 1\' 6 5 - 3 - | 2 3 5 3 2 1 6, - | 1 - - - - - 0 0',
         B='3 - 3 5 6 - 5 3 | 2 - 1 2 ~3 - - - | 5 - 5 6 1\' 6 5 3 | 5 - - - 6 - 5 -'),

    dict(id='zodiac_pig', title='元宝滚滚', key='F', mode='major', meter='4/4', bpm=110, seed=512,
         lead='zheng', lead2='dizi', counter='xiao', harm='yangqin',
         comp=dict(kind='oompah', inst='ruan', vel=0.4),
         bass=None, pad=None, perc=['muyu', 'tanggu'],
         A='1 3 5 3 1 3 5 3 | 6 5 6 1\' 5 - - - | 2 3 5 3 2 3 5 3 | 2 - 1 - 2 - - - |'
           '1 3 5 3 6 5 3 5 | 1\' - 6 - 5 - 3 - | 2 3 2 1 6, 1 2 3 | 1 - - - 0 0 0 0',
         B='5 - 6 - 1\' - 2\' - | 1\' 6 5 6 1\' - - - | 6 5 3 5 6 5 3 2 | 3 - - - 2 - - -'),
]
