import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeCardComponent } from './card.component';

describe('CeCardComponent', () => {
  let fixture: ComponentFixture<CeCardComponent>;
  let component: CeCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default accent=null', () => {
    expect(component.accent()).toBe(null);
  });

  it('should have default padded=true', () => {
    expect(component.padded()).toBe(true);
  });

  it('should render no accent class by default', () => {
    const card: HTMLElement = fixture.nativeElement.querySelector('.ce-card');
    expect(card.classList.contains('accent-primary')).toBe(false);
  });

  ['primary', 'success', 'warning', 'danger', 'info'].forEach((accent) => {
    it(`should render accent-${accent} class`, () => {
      fixture.componentRef.setInput('accent', accent as any);
      fixture.detectChanges();
      const card: HTMLElement = fixture.nativeElement.querySelector('.ce-card');
      expect(card.classList.contains(`accent-${accent}`)).toBe(true);
    });
  });

  it('should render padded body by default', () => {
    const body: HTMLElement = fixture.nativeElement.querySelector('.ce-card-body');
    expect(body.classList.contains('unpadded')).toBe(false);
  });

  it('should render unpadded body when padded=false', () => {
    fixture.componentRef.setInput('padded', false);
    fixture.detectChanges();
    const body: HTMLElement = fixture.nativeElement.querySelector('.ce-card-body');
    expect(body.classList.contains('unpadded')).toBe(true);
  });

  it('should render card with ce-card class', () => {
    const card: HTMLElement = fixture.nativeElement.querySelector('.ce-card');
    expect(card).toBeTruthy();
  });
});
