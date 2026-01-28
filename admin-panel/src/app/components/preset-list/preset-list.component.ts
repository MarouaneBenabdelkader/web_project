import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Important for *ngFor
import { RouterModule } from '@angular/router';
import { PresetService } from '../../services/preset.service';

@Component({
    selector: 'app-preset-list',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './preset-list.component.html',
    styleUrl: './preset-list.component.css'
})
export class PresetListComponent implements OnInit {
    presets: any[] = [];
    loading = false;
    error = '';

    constructor(private presetService: PresetService) { }

    ngOnInit(): void {
        this.loadPresets();
    }

    loadPresets() {
        this.loading = true;
        this.presetService.getPresets().subscribe({
            next: (data) => {
                this.presets = data;
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.error = 'Failed to load presets';
                this.loading = false;
            }
        });
    }

    rename(preset: any) {
        const newName = prompt('Enter new name:', preset.name);
        if (newName && newName !== preset.name) {
            this.presetService.updatePreset(preset._id, { name: newName }).subscribe({
                next: (updated) => {
                    preset.name = updated.name; // Optimistic update
                },
                error: (err) => alert('Failed to rename')
            });
        }
    }

    delete(id: string) {
        if (confirm('Are you sure you want to delete this preset?')) {
            this.presetService.deletePreset(id).subscribe({
                next: () => {
                    this.presets = this.presets.filter(p => p._id !== id);
                },
                error: (err) => alert('Failed to delete')
            });
        }
    }
}
