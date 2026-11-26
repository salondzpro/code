# Voix off « Ma pub » (lib/bioVideo.ts, VOIX) — voix neuronale ar-DZ-IsmaelNeural (homme, accent
# algérien), texte du propriétaire écrit en lettres arabes (darija + français prononcé à l'algérienne).
# 26 nov. 2026. Débit +22 %, ton +6 Hz (pub enjouée). Garder les sous-titres de VOIX identiques au dit.
#   python -m venv venv && venv/Scripts/python -m pip install edge-tts
#   venv/Scripts/python scripts/make-video-voice.py <dossier> +22% +6Hz
#   node scripts/import-voix.mjs <dossier>/phrase-1.mp3 … <dossier>/phrase-7.mp3
import asyncio
import sys
import edge_tts

VOIX = "ar-DZ-IsmaelNeural"
LIGNES = [
    "سلام! ريزيرفي، ساهلة بزّاف!",
    "كليكي سور لو ليان، فلابيو.",
    "خيّر لا بريستاسيون، اللي تحب.",
    "لو جور، و لور، كيما يجيك.",
    "كونيكتي توا ب جوجل، في أون سيكوند.",
    "هاذي هيّا! سي ريزيرفي!",
    "صالون دي زاد! يلّا، ريزيرفي دوكا!",
]


async def main(dossier: str, rate: str, pitch: str) -> None:
    for i, texte in enumerate(LIGNES, 1):
        com = edge_tts.Communicate(texte, VOIX, rate=rate, pitch=pitch)
        await com.save(f"{dossier}/phrase-{i}.mp3")
        print(f"phrase-{i}.mp3")


asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "+10%", sys.argv[3] if len(sys.argv) > 3 else "+6Hz"))
