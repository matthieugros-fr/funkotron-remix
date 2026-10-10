"""Génère les musiques du jeu avec l'API ACE Music (acemusic.ai).

La clé n'est jamais écrite dans le projet : elle vient de la variable d'environnement ACE_MUSIC_API_KEY.
Usage :  python3 tools/generer-musiques.py [nom ...]   (la clé est demandée, ou lue dans ACE_MUSIC_API_KEY)
Sans nom, génère tous les morceaux qui n'existent pas encore dans public/music/.
"""
import base64, json, os, ssl, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

# Le Python de python.org n'a pas toujours ses certificats : on prend ceux du système (macOS).
CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem') if os.path.exists('/etc/ssl/cert.pem') else ssl.create_default_context()

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'music')
BPM = 104
TRACKS = {
    'titre': (90, "90s funk hip-hop instrumental, slap bass groove, wah-wah guitar, punchy brass stabs, Rhodes, talk box hook, vinyl crackle, playful and cocky, video game title theme, catchy loop"),
    'etages-1': (120, "laid-back G-funk instrumental, rubbery synth bass, clean funk guitar chops, soft Moog lead, boom-bap drums, sunny and relaxed, retro 16-bit video game exploration loop, no vocals"),
    'etages-2': (120, "uptempo funk instrumental, tight slap bass, horn section riffs, clavinet, crisp breakbeat, cowbell, energetic and cheeky, retro game level music, seamless loop, no vocals"),
    'etages-3': (120, "spacey jazz-funk instrumental, deep fretless bass, airy synth pads, vibraphone, muted trumpet, soft swing drums, dreamy and mysterious, outer space video game level, loop, no vocals"),
    'etages-4': (120, "dark cinematic funk instrumental, heavy sub bass, slow brooding organ, distant choir pads, tense string swells, sparse funky drums, epic and ominous, approaching a black hole, video game final level, no vocals"),
    'jam': (90, "live funk jam instrumental, call and response between slap bass and horns, drum breaks every 8 bars, very clear steady beat, groovy and fun, rhythm game music, no vocals"),
    'ascenseur': (6, "short funky fanfare jingle, rising brass and slap bass run, quick drum fill, triumphant and silly, retro video game level-up sting, instrumental"),
    'game-over': (8, "short sad funk jingle, slow descending wah guitar, mournful trombone slide, lazy bass, comedic defeat, retro video game game over, instrumental"),
    'morceau': (4, "short sparkling victory sting, funky horn hit, synth arpeggio upward, cymbal swell, joyful, retro video game item collected, instrumental"),
}

def generate(name):
    dur, prompt = TRACKS[name]
    body = {
        'messages': [{'role': 'user', 'content': f'<prompt>{prompt}</prompt>'}],
        'audio_config': {'duration': dur, 'bpm': BPM, 'instrumental': True, 'format': 'mp3', 'time_signature': '4/4'},
    }
    req = urllib.request.Request('https://api.acemusic.ai/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + os.environ['ACE_MUSIC_API_KEY'], 'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=900, context=CTX))
        url = r['choices'][0]['message']['audio'][0]['audio_url']['url']
    except urllib.error.HTTPError as e:
        return f'{name} : erreur {e.code} {e.read()[:300]!r}'
    except Exception as e:
        return f'{name} : échec ({e})'
    path = os.path.join(OUT, name + '.mp3')
    with open(path, 'wb') as f:
        f.write(base64.b64decode(url.split(',', 1)[1]))
    return f'{name} : OK ({os.path.getsize(path) // 1024} Ko)'

if __name__ == '__main__':
    if not os.environ.get('ACE_MUSIC_API_KEY'):
        # saisie masquée : la clé ne s'affiche pas et n'est écrite nulle part
        import getpass
        os.environ['ACE_MUSIC_API_KEY'] = getpass.getpass('Colle ta clé ACE Music (rien ne s\'affiche) puis Entrée : ').strip()
        if not os.environ['ACE_MUSIC_API_KEY']:
            sys.exit('Pas de clé, rien à faire.')
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or [n for n in TRACKS if not os.path.exists(os.path.join(OUT, n + '.mp3'))]
    print('Génération :', ', '.join(names), '(quelques minutes)')
    with ThreadPoolExecutor(3) as pool:
        for line in pool.map(generate, names):
            print(line, flush=True)
