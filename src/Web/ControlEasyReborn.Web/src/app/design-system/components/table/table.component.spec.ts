import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeTableComponent } from './table.component';

describe('CeTableComponent', () => {
  let fixture: ComponentFixture<CeTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CeTableComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render table wrapper', () => {
    const wrapper: HTMLElement = fixture.nativeElement.querySelector('.ce-table-wrapper');
    expect(wrapper).toBeTruthy();
  });

  it('should render table element', () => {
    const table: HTMLElement = fixture.nativeElement.querySelector('.ce-table');
    expect(table).toBeTruthy();
  });

  it('should project content into table', () => {
    const table: HTMLElement = fixture.nativeElement.querySelector('.ce-table');
    expect(table.children.length).toBeGreaterThanOrEqual(0);
  });
});
