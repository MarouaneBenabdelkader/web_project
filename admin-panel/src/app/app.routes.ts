import { Routes } from '@angular/router';
import { PresetListComponent } from './components/preset-list/preset-list.component';
import { PresetCreateComponent } from './components/preset-create/preset-create.component';
import { PresetPreviewComponent } from './components/preset-preview/preset-preview.component';

export const routes: Routes = [
    { path: '', component: PresetListComponent },
    { path: 'create', component: PresetCreateComponent },
    { path: 'preview/:id', component: PresetPreviewComponent }
];
