import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresetPreview } from './preset-preview';

describe('PresetPreview', () => {
  let component: PresetPreview;
  let fixture: ComponentFixture<PresetPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresetPreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PresetPreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
