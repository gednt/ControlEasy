import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to system theme when no stored value', () => {
    expect(service.theme()).toBe('system');
  });

  it('should load stored theme from localStorage', () => {
    localStorage.setItem('ce.theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(svc.theme()).toBe('dark');
  });

  it('should set theme via setTheme', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
  });

  it('should persist theme to localStorage', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(localStorage.getItem('ce.theme')).toBe('dark');
  });

  it('should toggle light -> dark -> system -> light', () => {
    service.setTheme('light');
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('system');
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('light');
  });

  it('should resolve system to light or dark', () => {
    service.setTheme('system');
    TestBed.flushEffects();
    const resolved = service.resolvedTheme();
    expect(['light', 'dark']).toContain(resolved);
  });

  it('should resolve dark theme to dark', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(service.resolvedTheme()).toBe('dark');
  });

  it('should resolve light theme to light', () => {
    service.setTheme('light');
    TestBed.flushEffects();
    expect(service.resolvedTheme()).toBe('light');
  });

  it('should apply data-theme attribute to document', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
