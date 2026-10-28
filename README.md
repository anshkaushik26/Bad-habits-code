# Code Lyric Video (Remotion)

A lyric video where your lyrics are typed as code in a VS Code-style editor. The camera follows the cursor in 3D, whips between lines with motion blur, punches on kicks, and git moments happen on the beat (commit, merge conflict, force-push popup, and a `git log` ending).

## Setup (Mac M2)

```bash
# 1. Node.js LTS from nodejs.org (or: brew install node)
cd codelyric
npm install
npm run dev          # opens Remotion Studio in your browser: scrub the timeline with audio
npm run render       # writes out/video.mp4 (1080x1920, 30fps)
```

## Your workflow

1. **Audio**: put your clip in `public/` as `song.mp3`. Use mp3 or wav; it gets cut to the length of the clip automatically.
2. **Beats** (optional, but it drives the camera punches): `pip3 install librosa`, then `npm run beats`.
3. **Write your lyrics as code**: open `tools/sync.html` in Chrome (double-click it).
   - Load your audio.
   - Type your code-lyrics in box 1. Put `|` before every word or chunk that should start typing on its own sung moment.
4. **Tap the sync**: set the speed to 0.75x, click **Start tapping from line 1**, and press **Space** every time a chunk is sung.
   - Backspace undoes a tap. To redo one line, type its number in the box next to **Start tapping from line**, then click the button.
   - Press 1 to 6 at any moment to drop an effect.
   - Click **Review (karaoke)** to check the timing. Fix individual times in the table, or nudge everything at once.
5. **Download lyrics.json** and replace `src/data/lyrics.json` with it.
6. Run `npm run dev`, check the timing, then `npm run render`.

## lyrics.json reference

```jsonc
{
  "fileName": "bad_habits.js",   // tab + title
  "folder": "lyrics",            // terminal path ~/lyrics
  "branch": "main",
  "audio": "song.mp3",           // file in public/
  "offset": 0,                    // shift ALL lyric times (seconds). Lyrics late? use a negative number
  "lead": 0.05,                   // visuals run this far ahead of audio. 0.03–0.08 feels tight
  "lines": [
    { "text": "let |me = |new |Habit(|\"again\");", "times": [4.08, 4.43, 4.78, 5.14, 5.50] }
  ],
  "fx": [
    { "t": 11.9, "type": "shake" },
    { "t": 13.6, "type": "commit", "msg": "optional custom message" },
    { "t": 8.7,  "type": "squiggle", "line": 4, "seg": 2 },
    { "t": 20.4, "type": "conflict", "dur": 1.4 },
    { "t": 22.9, "type": "popup", "title": "Force push to 'main'?", "body": "…", "dur": 2.2 },
    { "t": 28.2, "type": "ending" }
  ]
}
```

- `times` has one number per `|` chunk: the second that chunk starts being sung.
- Letters are spread across the sung length of each chunk, so long notes type slowly and fast lines type fast.
- `commit`: the camera flies to the terminal, `git commit -am "<string in that line>"` runs, and the green change bars clear.
- `ending`: the camera pulls back to the whole window and `git log --oneline` lists every line as a commit.

## Writing lyrics as code

- Nouns become variables or objects, and verbs become function calls: "I keep thinking of you" → `me.|think(|of.|you);`
- Repeats and choruses become `while(true)` or `for` loops. "If…" lines become `if/else`. Leaving becomes `break` or `exit()`. Memories become `git log`.
- Every sung word must be readable on screen when it's sung, so start a new chunk at each sung word.
- Put git moments on the musical moments:
  - `commit` at the end of a hook
  - `conflict` and `shake` on a drop or tension
  - `popup` (force push) on the peak line
  - `ending` on the last bar

## Tuning

- Colours: `src/highlight.ts`
- Layout and font size: `L` in `src/engine.ts`
- Camera zoom (3.0), tilt and spring speeds: `simulateCamera` in `src/engine.ts` and the `rx`/`ry` lines in `src/CodeLyric.tsx`
- Motion-blur strength: the `0.45` multiplier in `src/CodeLyric.tsx`

## Instagram

If Instagram mutes the song: export a silent copy with `npx remotion render CodeLyric out/silent.mp4 --muted`, post it, add the track with Instagram's music picker, and match the start point.
