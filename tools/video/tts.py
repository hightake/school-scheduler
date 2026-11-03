"""הקראת טקסט לקובץ mp3 בקול עברי (edge-tts).
שימוש: python3 tts.py VOICE OUT.mp3 "טקסט" [קצב, למשל +4%]
אם מוגדר משתנה הסביבה TTS_CA_BUNDLE – משתמשים בו כקובץ תעודות (לרשתות עם פרוקסי).
"""
import os, sys, asyncio
if os.environ.get('TTS_CA_BUNDLE'):
    import certifi
    certifi.where = lambda: os.environ['TTS_CA_BUNDLE']
import edge_tts


async def main(voice, out, text, rate='+0%'):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else '+0%'))
