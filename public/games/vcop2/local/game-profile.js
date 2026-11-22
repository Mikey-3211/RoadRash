// Version-specific file fingerprints; no game bytes.
// Recovered from this EXE's actual polling loop. Runtime checks its current
// executable bytes again before accepting a cooperative idle wait.
export const gameIdlePoll = Object.freeze({ returnAddress: 0x40d8c4, deadlineAddress: 0x4cebbc });
// Supported EXE only: 0x41131e writes phase 11 on Proving Ground confirmation;
// its initializer advances to phase 12. Read only, after module hash verification.
export const gameModePhase = Object.freeze({ address: 0x4cf1b4, width: 2, provingGround: [11, 12] });
// 0x425240 masks this substate with 0x1f; slot 9 at 0x47ff70 dispatches
// the gameplay updater (0x424b10). Loading/title/selector frames do not qualify.
export const gameArcadeState = Object.freeze({ phase: 7, address: 0x4cf120, width: 2,
  mask: 0x1f, playing: 9 });
export const gameProfile = [
  {
    "name": "DDGL.DLL",
    "size": 338432,
    "sha256": "50f609ebf7ab872bda838d7aaeb76bb0d8fef88118e5fc9a93aa766780ae7ec2"
  },
  {
    "name": "DPCTRL.DLL",
    "size": 40960,
    "sha256": "e83dcceae4fb4ffeff29a47fe0190ae63a6f910203c364c2f5efa85ed3ac1ea2"
  },
  {
    "name": "HGL_D3D.DLL",
    "size": 111616,
    "sha256": "d73044ddb0760719de55538e7222fdaed83e80bffa31ac570a6464d11518218d"
  },
  {
    "name": "HGL_DD.DLL",
    "size": 54272,
    "sha256": "6cdad5094ea08736da042a3a6abfa109a8e986acedc9b937e56756f4e542c77f"
  },
  {
    "name": "PG_STG1.DLL",
    "size": 904704,
    "sha256": "d3ac106259677d253b7cf2d77b6eec29757677ecddac4ae937a74b0a1ded3996"
  },
  {
    "name": "PG_STG2.DLL",
    "size": 486400,
    "sha256": "96879202342bc0c0722c1d5312b1cfdd2e573313a5f1b0e505a55b6b244a97a0"
  },
  {
    "name": "PG_STG3.DLL",
    "size": 1101824,
    "sha256": "29cc4eb471895706ed9e2300c1f25df06291011bb805ca401b9b70c811dd9df7"
  },
  {
    "name": "PPJ2DD.EXE",
    "size": 992768,
    "sha256": "1aa51ac02f8612fa8367d3de8d6926de23f77b7d4fa83bb771e71d46151a2623"
  },
  {
    "name": "WINCPUID.DLL",
    "size": 122368,
    "sha256": "102439d25f0f753b718472c5ea48076d95bb67d9630c0d22897cb4386139fe2a"
  }
];
