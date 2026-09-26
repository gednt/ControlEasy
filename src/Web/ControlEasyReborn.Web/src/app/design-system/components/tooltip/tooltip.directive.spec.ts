import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CeTooltipDirective } from './tooltip.directive';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

@Component({
  standalone: true,
  imports: [CeTooltipDirective],
  template: '<button ceTooltip="Test tooltip">Hover me</button>',
})
class TestTooltipHostComponent {}

describe('CeTooltipDirective', () => {
  let fixture: ComponentFixture<TestTooltipHostComponent>;
  let directive: CeTooltipDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestTooltipHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestTooltipHostComponent);
    fixture.detectChanges();
    const debugEl: DebugElement = fixture.debugElement.query(By.directive(CeTooltipDirective));
    directive = debugEl.injector.get(CeTooltipDirective);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  it('should have text input', () => {
    expect(directive.text).toBe('Test tooltip');
  });

  it('should clean up on destroy', () => {
    spyOn(directive as any, 'hide').and.callThrough();
    directive.ngOnDestroy();
    expect((directive as any).hide).toHaveBeenCalled();
  });
});
