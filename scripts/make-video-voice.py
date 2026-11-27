# Voix off « Ma pub » (lib/bioVideo.ts, VOIX) — FRANÇAIS, style UGC soigné (27 nov. 2026, demande du
# propriétaire : « pas trop street, plutôt fun et médiatique ») : une cliente / un client qui raconte
# à la première personne, ton enjoué de présentatrice, sans « les gars » ni « les filles ». Femme pour les salons de femmes, homme pour les salons d'hommes.
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
        "Vous allez adorer : je réserve en 30 secondes !",
        "Un clic sur le lien dans la bio…",
        "Je choisis ma prestation…",
        "Le jour, l'heure… c'est moi qui décide !",
        "Je me connecte avec Google, en un instant.",
        "Et voilà, c'est réservé ! Bluffant, non ?",
        "À vous de jouer : le lien est dans la bio !",
    ],
    "h": [
        "Vous allez adorer : je réserve en 30 secondes !",
        "Un clic sur le lien dans la bio…",
        "Je choisis ma prestation…",
        "Le jour, l'heure… c'est moi qui décide !",
        "Je me connecte avec Google, en un instant.",
        "Et voilà, c'est réservé ! Bluffant, non ?",
        "À vous de jouer : le lien est dans la bio !",
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
