# Voix off « Ma pub » (lib/bioVideo.ts, VOIX) — FRANÇAIS, avec émotion (26 nov. 2026, demande du
# propriétaire) : voix d'HOMME pour les salons d'hommes, de FEMME pour les salons de femmes.
# Voix neuronales multilingues de Microsoft (les plus expressives) : Rémy (h) et Vivienne (f).
# Les phrases DOIVENT rester identiques aux sous-titres de VOIX (lib/bioVideo.ts).
#   python -m venv venv && venv/Scripts/python -m pip install edge-tts
#   venv/Scripts/python scripts/make-video-voice.py <dossier>
#   node scripts/import-voix.mjs --genre h <dossier>/h-1.mp3 … <dossier>/h-7.mp3
#   node scripts/import-voix.mjs --genre f <dossier>/f-1.mp3 … <dossier>/f-7.mp3
import asyncio
import sys
import edge_tts

VOIX = {"h": "fr-FR-RemyMultilingualNeural", "f": "fr-FR-VivienneMultilingualNeural"}
LIGNES = [
    "Réserver chez nous ? Trop simple !",
    "Touchez le lien dans la bio.",
    "Choisissez votre prestation.",
    "Le jour, l'heure… comme vous voulez !",
    "Connectez-vous avec Google, en une seconde.",
    "Et voilà, c'est réservé !",
    "Salon DZ. Réservez dès maintenant !",
]


async def main(dossier: str) -> None:
    for genre, voix in VOIX.items():
        for i, texte in enumerate(LIGNES, 1):
            # Débit un peu vif et ton légèrement relevé : une pub enjouée, pas une lecture.
            com = edge_tts.Communicate(texte, voix, rate="+8%", pitch="+3Hz")
            await com.save(f"{dossier}/{genre}-{i}.mp3")
            print(f"{genre}-{i}.mp3")


asyncio.run(main(sys.argv[1]))
