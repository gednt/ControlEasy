import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeTabsComponent, CeTabComponent } from './tabs.component';

describe('CeTabsComponent', () => {
  let fixture: ComponentFixture<CeTabsComponent>;
  let component: CeTabsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeTabsComponent, CeTabComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeTabsComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default activeIndex=0', () => {
    expect(component.activeIndex()).toBe(0);
  });

  it('should render tablist with role=tablist', () => {
    const tablist: HTMLElement = fixture.nativeElement.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
  });

  it('should select tab on selectTab call', () => {
    component.selectTab(2);
    expect(component.activeIndex()).toBe(2);
  });

  it('should emit activeIndexChange on selectTab', () => {
    let emitted = -1;
    component.activeIndexChange.subscribe((i: number) => (emitted = i));
    component.selectTab(1);
    expect(emitted).toBe(1);
  });
});

describe('CeTabComponent', () => {
  let fixture: ComponentFixture<CeTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeTabComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeTabComponent);
    fixture.componentRef.setInput('label', 'Test Tab');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have required label input', () => {
    expect(fixture.componentInstance.label()).toBe('Test Tab');
  });
});
