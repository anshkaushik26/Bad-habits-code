import React from 'react';
import { Composition } from 'remotion';
import { CodeLyric } from './CodeLyric';
import { Outro } from './Outro';
import { Credits } from './Credits';

// Length of your song clip in seconds. Change this if you swap the audio.
const SONG_SECONDS = 33.45;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="CodeLyric" component={CodeLyric} width={1080} height={1920} fps={30} durationInFrames={Math.ceil(SONG_SECONDS * 30)} />
    <Composition id="Credits" component={Credits} width={1080} height={1920} fps={30} durationInFrames={150} />
    <Composition id="Outro" component={Outro} width={1080} height={1920} fps={30} durationInFrames={120} />
  </>
);
