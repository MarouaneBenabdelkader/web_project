import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class PresetService {
    private apiUrl = 'https://web-sampler.onrender.com/api/presets';

    constructor(private http: HttpClient) { }

    getPresets(): Observable<any[]> {
        return this.http.get<any[]>(this.apiUrl);
    }

    getPreset(id: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${id}`);
    }

    createPreset(formData: FormData): Observable<any> {
        return this.http.post<any>(this.apiUrl, formData);
    }

    updatePreset(id: string, data: any): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/${id}`, data);
    }

    deletePreset(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }
}
