import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeAvatarComponent } from './avatar.component';

describe('CeAvatarComponent', () => {
  let fixture: ComponentFixture<CeAvatarComponent>;
  let component: CeAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeAvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeAvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default size=md', () => {
    expect(component.size()).toBe('md');
  });

  it('should have default src=null', () => {
    expect(component.src()).toBe(null);
  });

  it('should render initials when no src', () => {
    fixture.componentRef.setInput('name', 'Joao Silva');
    fixture.detectChanges();
    const initials: HTMLElement = fixture.nativeElement.querySelector('.ce-avatar-initials');
    expect(initials).toBeTruthy();
    expect(initials.textContent).toContain('JS');
  });

  it('should render single initial for single word name', () => {
    fixture.componentRef.setInput('name', 'Carlos');
    fixture.detectChanges();
    const initials: HTMLElement = fixture.nativeElement.querySelector('.ce-avatar-initials');
    expect(initials.textContent).toContain('C');
  });

  it('should render image when src provided', () => {
    fixture.componentRef.setInput('src', 'https://example.com/photo.jpg');
    fixture.componentRef.setInput('name', 'Joao');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.ce-avatar-img');
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/photo.jpg');
  });

  it('should set alt to name on image', () => {
    fixture.componentRef.setInput('src', 'https://example.com/photo.jpg');
    fixture.componentRef.setInput('name', 'Joao');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.ce-avatar-img');
    expect(img.alt).toBe('Joao');
  });

  ['xs', 'sm', 'md', 'lg', 'xl'].forEach((size) => {
    it(`should render size-${size} class`, () => {
      fixture.componentRef.setInput('size', size as any);
      fixture.detectChanges();
      const el: HTMLElement =
        fixture.nativeElement.querySelector('.ce-avatar-initials') ||
        fixture.nativeElement.querySelector('.ce-avatar-img');
      expect(el.classList.contains(`size-${size}`)).toBe(true);
    });
  });

  it('should produce same background color for same name', () => {
    fixture.componentRef.setInput('name', 'Joao');
    fixture.detectChanges();
    const bg1 = component.backgroundColor();
    fixture.componentRef.setInput('name', 'Joao');
    fixture.detectChanges();
    const bg2 = component.backgroundColor();
    expect(bg1).toBe(bg2);
  });

  it('should produce different background color for different names', () => {
    fixture.componentRef.setInput('name', 'Alice');
    fixture.detectChanges();
    const bg1 = component.backgroundColor();
    fixture.componentRef.setInput('name', 'Bob');
    fixture.detectChanges();
    const bg2 = component.backgroundColor();
    expect(bg1).not.toBe(bg2);
  });

  it('should show ? for empty name', () => {
    fixture.componentRef.setInput('name', '');
    fixture.detectChanges();
    expect(component.initials()).toBe('?');
  });
});
