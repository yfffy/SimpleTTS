"use client";

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { TTSSettings as TTSSettingsType } from '@/types';

interface TTSSettingsProps {
  settings: TTSSettingsType;
  onSettingsChange: (settings: TTSSettingsType) => void;
}

export default function TTSSettings({ settings, onSettingsChange }: TTSSettingsProps) {
  const handleRateChange = (value: number[]) => {
    const rate = `${value[0] > 0 ? '+' : ''}${value[0]}%`;
    onSettingsChange({ ...settings, rate });
  };

  const handleVolumeChange = (value: number[]) => {
    const volume = `${value[0] > 0 ? '+' : ''}${value[0]}%`;
    onSettingsChange({ ...settings, volume });
  };

  const handlePitchChange = (value: number[]) => {
    const pitch = `${value[0] > 0 ? '+' : ''}${value[0]}Hz`;
    onSettingsChange({ ...settings, pitch });
  };

  // Parse values from string format to numbers for the sliders
  const parseRate = (): number => {
    const match = settings.rate.match(/([+-]?\d+)%/);
    return match ? parseInt(match[1]) : 0;
  };

  const parseVolume = (): number => {
    const match = settings.volume.match(/([+-]?\d+)%/);
    return match ? parseInt(match[1]) : 0;
  };

  const parsePitch = (): number => {
    const match = settings.pitch.match(/([+-]?\d+)Hz/);
    return match ? parseInt(match[1]) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">
            Rate
          </label>
          <span className="text-xs text-muted-foreground">
            {settings.rate}
          </span>
        </div>
        <Slider
          defaultValue={[parseRate()]}
          min={-100}
          max={100}
          step={5}
          onValueChange={handleRateChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Slower</span>
          <span>Default</span>
          <span>Faster</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">
            Volume
          </label>
          <span className="text-xs text-muted-foreground">
            {settings.volume}
          </span>
        </div>
        <Slider
          defaultValue={[parseVolume()]}
          min={-100}
          max={100}
          step={5}
          onValueChange={handleVolumeChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Quieter</span>
          <span>Default</span>
          <span>Louder</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">
            Pitch
          </label>
          <span className="text-xs text-muted-foreground">
            {settings.pitch}
          </span>
        </div>
        <Slider
          defaultValue={[parsePitch()]}
          min={-100}
          max={100}
          step={5}
          onValueChange={handlePitchChange}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lower</span>
          <span>Default</span>
          <span>Higher</span>
        </div>
      </div>
    </div>
  );
} 