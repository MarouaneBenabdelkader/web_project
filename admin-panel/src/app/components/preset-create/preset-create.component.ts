import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Important for *ngFor, *ngIf
import { FormsModule } from '@angular/forms'; // Important for [(ngModel)]
import { Router } from '@angular/router';
import { PresetService } from '../../services/preset.service';

@Component({
    selector: 'app-preset-create',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './preset-create.component.html',
    styleUrl: './preset-create.component.css'
})
export class PresetCreateComponent {
    name = '';
    category = 'Drums';
    description = '';

    // 9 Pads
    pads = [
        { id: 'pad7', name: 'Tom Low', type: 'url', value: '' },
        { id: 'pad8', name: 'Crash', type: 'url', value: '' },
        { id: 'pad9', name: 'Ride', type: 'url', value: '' },
        { id: 'pad4', name: 'Hi-Hat Open', type: 'url', value: '' },
        { id: 'pad5', name: 'Tom High', type: 'url', value: '' },
        { id: 'pad6', name: 'Tom Mid', type: 'url', value: '' },
        { id: 'pad1', name: 'Kick', type: 'url', value: '' }, // Bottom Left
        { id: 'pad2', name: 'Snare', type: 'url', value: '' },
        { id: 'pad3', name: 'Hi-Hat Closed', type: 'url', value: '' }
    ];

    fileMap = new Map<string, File>(); // padId -> File

    constructor(private presetService: PresetService, private router: Router) { }

    onFileSelected(event: any, padId: string) {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            this.fileMap.set(padId, file);
        }
    }

    submit() {
        const formData = new FormData();
        const soundsMeta: any[] = [];
        const filesToUpload: File[] = [];

        this.pads.forEach(pad => {
            if (!pad.value && !this.fileMap.has(pad.id)) return; // Skip empty pads?

            const meta: any = {
                padId: pad.id,
                name: pad.name
            };

            if (pad.type === 'file' && this.fileMap.has(pad.id)) {
                const file = this.fileMap.get(pad.id)!;
                meta.fileName = file.name; // Backend matches this
                filesToUpload.push(file);
            } else {
                meta.path = pad.value; // URL
            }
            soundsMeta.push(meta);
        });

        const presetData = {
            name: this.name,
            category: this.category,
            description: this.description,
            sounds: soundsMeta
        };

        formData.append('data', JSON.stringify(presetData));
        filesToUpload.forEach(file => {
            formData.append('files', file);
        });

        this.presetService.createPreset(formData).subscribe({
            next: () => {
                alert('Preset created!');
                this.router.navigate(['/']);
            },
            error: (err) => {
                console.error(err);
                alert('Failed to create preset: ' + (err.error?.message || err.message));
            }
        });
    }
}
