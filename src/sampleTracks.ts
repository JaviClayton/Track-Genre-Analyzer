import { Track, CurationStatus } from "./types.js";

export const SAMPLE_TRACKS_RAW = `Artwork\tTrack Title\tArtist\tAlbum\tGenre\tRating\tTime\tBPM\tKey\tLabel\tColor\tComments\tMy Tag\tMix Name\tDate Added\tDate Created\tLocation
\tThe Rapture Pt.III\t&ME/Black Coffee/Keinemusik\tThe Rapture Pt.III\t\t**** \t06:57\t120.00\t8A\tEnergy 5\t\t08A - 120 - 5\t\t\t2026-03-22\t2026-02-06\tC:/Users/javic/OneDrive/Music/Downloads/The Rapture Pt.III - &ME.mp3
\tMahanyela\t40D/Wazimbo/ISABEL NOVELLA\tMahanyela\t\t***  \t04:04\t121.00\t8A\tEnergy 4\t\t08A - 121 - 4\tAfrican\t\t2026-05-11\t2026-05-11\tC:/Users/javic/OneDrive/Music/Downloads/Mahanyela.mp3
\tlevitation\tAaron Hibell/Felsmann + Tiley\tAstral Projection\t\t***  \t02:48\t133.33\t4B\tEnergy 3\t\t04B - 134 - 3\tDowntempo / Chill\t\t2026-03-22\t2026-02-06\tC:/Users/javic/OneDrive/Music/Downloads/levitation.mp3
\tGratitude\tAbove & Beyond/aname/Marty Longstaff\tGratitude\t\t**** \t03:53\t128.00\t6B\tEnergy 5\t\t06B - 128 - 5\t\t\t2026-03-22\t2026-02-06\tC:/Users/javic/OneDrive/Music/Downloads/Gratitude.mp3
\tJorge - Satori Remix\tAcid Pauli/Satori\tJorge - Satori Remix\t\t     \t06:10\t59.00\t11A\tEnergy 5\t\t11A - 118 - 5\t\t\t2026-05-21\t2026-05-20\tC:/Users/javic/OneDrive/Music/Downloads/Jorge - Satori Remix.mp3
\tONE FOR YOU\tALLEYCVT/Levity\tONE FOR YOU\t\t***  \t02:32\t155.00\t7A\tEnergy 7\t\t07A - 155 - 7\tDubstep\t\t2026-03-22\t2026-02-06\tC:/Users/javic/OneDrive/Music/Downloads/ONE FOR YOU.mp3
\tHunger of the Pine\talt-J\tHunger of the Pine\t\t*****\t04:59\t93.64\t7A\tEnergy 5\t\t07A - 94 - 5\tDowntempo / Chill\t\t2026-04-11\t2026-04-11\tC:/Users/javic/Downloads/Hunger of the Pine.mp3
\tAmor Amor\tArno Elias\tParadise Overdose\t\t*****\t03:48\t86.63\t8A\tEnergy 6\t\t08A - 87 - 6\tSpanish Guitar / Flamenco / Spanish\t\t2026-03-22\t2026-02-06\tC:/Users/javic/OneDrive/Music/Downloads/Amor Amor.mp3
\tGlue\tBICEP\tBicep\t\t**** \t04:29\t130.00\t9A\tEnergy 6\t\t09A - 130 - 6\tDowntempo / Yoga\t\t2026-03-22\t2026-02-06\tC:/Users/javic/Downloads/Glue - BICEP.mp3
\tAnchor Point\tAhmed Spins/Stevo Atambire\tAnchor Point EP\tAfro House\t**** \t05:59\t123.00\t8A\tEnergy 5\t\t08A - 123 - 5\tAfro House / Phrases Updated / Cue Points Created / African\tTribal House Mix 1\t2025-02-16\t2025-02-16\tC:/Users/javic/OneDrive/Music/Downloads/Anchor Point.mp3
\tMwakaki\tZerb/Sofiya Nzau\tSURRENDER\tDance ; Pop\t*****\t03:28\t120.00\t6A\tEnergy 6\t\t06A - 120 - 6\tDance / Pop / Phrases Updated / Cue Points Created / African\tTribal House Mix 1; Afro House Mix 1\t2025-02-16\t2025-02-16\tC:/Users/javic/OneDrive/Music/Downloads/Mwakaki.mp3
\tFaded (Blacklizt Version) - HNTR Remix\tZHU/HNTR\tFaded (Blacklizt Version)(HNTR Remix)\tTechno (Peak Time ; Driving)\t**** \t03:13\t132.00\t7A\tEnergy 7\t\t07A - 132 - 7\tTechno (Peak Time / Driving) / Phrases Updated / Cue Points Created\t\t2026-01-18\t2026-01-19\tC:/Users/javic/OneDrive/Music/Downloads/Faded - HNTR.mp3`;

export function getSampleTracks(): Track[] {
  const lines = SAMPLE_TRACKS_RAW.split("\n");
  const headers = lines[0].split("\t");
  
  return lines.slice(1).map((line, index) => {
    const cols = line.split("\t");
    return {
      id: String(index + 1),
      originalRowIndex: index + 1,
      artwork: cols[0] || "",
      title: cols[1] || "",
      artist: cols[2] || "",
      album: cols[3] || "",
      genre: cols[4] || "",
      rating: cols[5] || "",
      time: cols[6] || "",
      bpm: cols[7] || "",
      key: cols[8] || "",
      label: cols[9] || "",
      color: cols[10] || "",
      comments: cols[11] || "",
      myTag: cols[12] || "",
      mixName: cols[13] || "",
      dateAdded: cols[14] || "",
      dateCreated: cols[15] || "",
      location: cols[16] || "",
      
      curatedGenre: "",
      curatedBpm: "",
      curatedKey: "",
      curationStatus: CurationStatus.IDLE,
      curationNotes: "",
      verificationSource: "",
      isModified: false,
      isSelected: false
    };
  });
}
