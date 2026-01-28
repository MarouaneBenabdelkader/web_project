import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresetCreate } from './preset-create';

describe('PresetCreate', () => {
  let component: PresetCreate;
  let fixture: ComponentFixture<PresetCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresetCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PresetCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
