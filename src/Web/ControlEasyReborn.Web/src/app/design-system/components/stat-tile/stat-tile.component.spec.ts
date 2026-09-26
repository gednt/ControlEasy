import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeStatTileComponent } from './stat-tile.component';

describe('CeStatTileComponent', () => {
  let fixture: ComponentFixture<CeStatTileComponent>;
  let component: CeStatTileComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeStatTileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeStatTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render label', () => {
    fixture.componentRef.setInput('label', 'Total Residents');
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-label');
    expect(label.textContent).toContain('Total Residents');
  });

  it('should render value', () => {
    fixture.componentRef.setInput('value', 1248);
    fixture.detectChanges();
    const value: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-value');
    expect(value.textContent).toContain('1248');
  });

  it('should not render trend when null', () => {
    const trend = fixture.nativeElement.querySelector('.ce-stat-trend');
    expect(trend).toBeFalsy();
  });

  it('should render up trend with trend-up class', () => {
    fixture.componentRef.setInput('trend', { direction: 'up', value: '+12%', tone: 'success' });
    fixture.detectChanges();
    const trend: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-trend');
    expect(trend).toBeTruthy();
    expect(trend.classList.contains('trend-up')).toBe(true);
  });

  it('should render down trend with trend-down class', () => {
    fixture.componentRef.setInput('trend', { direction: 'down', value: '-5%', tone: 'danger' });
    fixture.detectChanges();
    const trend: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-trend');
    expect(trend).toBeTruthy();
    expect(trend.classList.contains('trend-down')).toBe(true);
  });

  it('should render flat trend with trend-flat class', () => {
    fixture.componentRef.setInput('trend', { direction: 'flat', value: '0%', tone: 'neutral' });
    fixture.detectChanges();
    const trend: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-trend');
    expect(trend).toBeTruthy();
    expect(trend.classList.contains('trend-flat')).toBe(true);
  });

  it('should render trend value', () => {
    fixture.componentRef.setInput('trend', { direction: 'up', value: '+12%', tone: 'success' });
    fixture.detectChanges();
    const value: HTMLElement = fixture.nativeElement.querySelector('.ce-stat-trend-value');
    expect(value.textContent).toContain('+12%');
  });
});
