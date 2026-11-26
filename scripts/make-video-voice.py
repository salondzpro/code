# Voix off « Ma pub » (lib/bioVideo.ts, VOIX) — FRANÇAIS, style UGC (26 nov. 2026, demande du
# propriétaire) : une vraie cliente / un vrai client qui montre son téléphone et raconte, à la
# première personne, avec émotion. Femme pour les salons de femmes, homme pour les salons d'hommes.
# Voix neuronales Microsoft : Vivienne (f) et Henri (h).
# Les phrases DOIVENT rester identiques aux sous-titres de VOIX (lib/bioVideo.ts).
#   python -m venv venv && venv/Scripts/python -m pip install edge-tts
#   venv/Scripts/python scripts/make-video-voice.py <dossier>
#   node scripts/import-voix.mjs --genre f <dossier>/f-1.mp3 … <dossier>/f-7.mp3
#   node scripts/import-voix.mjs --genre h <dossier>/h-1.mp3 … <dossier>/h-7.mp3
import asyncio
import sys
import edge_tts

VOIX = {"f": "fr-FR-VivienneMultilingualNeural", "h": "fr-FR-HenriNeural"}
LIGNES = {
    "f": [
        "Les filles, je vous montre comment je réserve !",
        "Je clique sur le lien dans sa bio…",
        "Je choisis ma prestation…",
        "Le jour, l'heure… franchement, trop facile !",
        "Je me connecte avec Google, et hop !",
        "C'est réservé ! Trop contente !",
        "Allez, foncez, le lien est dans la bio !",
    ],
    "h": [
        "Les gars, regardez comment je réserve !",
        "Je clique sur le lien dans sa bio…",
        "Je choisis ma prestation…",
        "Le jour, l'heure… franchement, ultra simple !",
        "Je me connecte avec Google, et hop !",
        "C'est réservé ! Trop facile !",
        "Allez, foncez, le lien est dans la bio !",
    ],
}


async def main(dossier: str) -> None:
    for genre, voix in VOIX.items():
        for i, texte in enumerate(LIGNES[genre], 1):
            # Débit naturel, ton un peu relevé : quelqu'un qui partage un bon plan, pas une annonce.
            com = edge_tts.Communicate(texte, voix, rate="+6%", pitch="+2Hz")
            await com.save(f"{dossier}/{genre}-{i}.mp3")
            print(f"{genre}-{i}.mp3")


asyncio.run(main(sys.argv[1]))
