import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PresetService } from '../../services/preset.service';

import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-preset-preview',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './preset-preview.component.html',
    styleUrl: './preset-preview.component.css'
})
export class PresetPreviewComponent implements OnInit, OnDestroy {
    preset: any = null;
    loading = true;
    error = '';
    audioCtx: AudioContext | null = null;

    // padId -> AudioBuffer
    buffers = new Map<string, AudioBuffer>();

    constructor(
        private route: ActivatedRoute,
        private presetService: PresetService
    ) { }

    ngOnInit() {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadPreset(id);
        }
    }

    ngOnDestroy() {
        if (this.audioCtx) {
            this.audioCtx.close();
        }
    }

    loadPreset(id: string) {
        this.presetService.getPreset(id).subscribe({
            next: (data) => {
                this.preset = data;
                this.loadSounds(data);
            },
            error: (err) => {
                this.error = 'Failed to load preset';
                this.loading = false;
            }
        });
    }

    async loadSounds(preset: any) {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;

        const promises = preset.sounds.map(async (sound: any) => {
            try {
                // Handle relative vs absolute paths
                let url = sound.path;
                if (url.startsWith('/uploads')) {
                    url = `https://web-sampler.onrender.com${url}`;
                }

                const response = await fetch(url);
                if (!response.ok) throw new Error('Fetch failed');
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                this.buffers.set(sound.padId, audioBuffer);
            } catch (e) {
                console.error(`Failed to load ${sound.name}`, e);
            }
        });

        await Promise.all(promises);
        this.loading = false;
    }

    playSound(padId: string) {
        if (!this.audioCtx || !this.buffers.has(padId)) return;

        try {
            const source = this.audioCtx.createBufferSource();
            source.buffer = this.buffers.get(padId)!;
            source.connect(this.audioCtx.destination);
            source.start(0);
        } catch (e) {
            console.error(e);
        }
    }

    // Helper to get sound name for a pad
    getPadName(padId: string): string {
        return this.preset?.sounds.find((s: any) => s.padId === padId)?.name || padId;
    }

    isLoaded(padId: string): boolean {
        return this.buffers.has(padId);
    }
}
