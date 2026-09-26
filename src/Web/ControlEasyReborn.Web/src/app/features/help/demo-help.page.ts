import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ce-demo-help-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="demo-help">
      <h1>Demo guide</h1>
      <p class="intro">
        ControlEasy is running in <strong>demo mode</strong> with curated sample data. All accounts use password
        <code>demo123</code>.
      </p>

      <section>
        <h2>Demo accounts</h2>
        <table class="credential-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Tenant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>platform&#64;controleasy.app</td>
              <td>PlatformAdmin</td>
              <td>Platform</td>
            </tr>
            <tr>
              <td>admin&#64;controleasy.app</td>
              <td>TenantAdmin</td>
              <td>[Demo] Residencial Aurora</td>
            </tr>
            <tr>
              <td>porteiro&#64;controleasy.app</td>
              <td>Porteiro</td>
              <td>[Demo] Residencial Aurora</td>
            </tr>
            <tr>
              <td>morador&#64;controleasy.app</td>
              <td>Morador</td>
              <td>[Demo] Residencial Aurora</td>
            </tr>
            <tr>
              <td>multi&#64;controleasy.app</td>
              <td>Multi-tenant</td>
              <td>Aurora + Parque Verde</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Walkthrough</h2>
        <ol>
          <li>Sign in as <code>porteiro&#64;controleasy.app</code>.</li>
          <li>Open <a routerLink="/residents">Residents</a> and search for Kratos or Chaves.</li>
          <li>Check apt 8 (Florinda, Quico, Girafales) and Sparta-1 (Kratos, Atreus).</li>
          <li>Sign in as <code>multi&#64;controleasy.app</code> to try the tenant picker.</li>
          <li>Sign in as <code>platform&#64;controleasy.app</code> for administration.</li>
        </ol>
      </section>

      <section>
        <h2>Reset</h2>
        <p>
          Run <code>docker compose … down -v</code> and start again, or call <code>POST /api/v1/demo/reset</code> as
          PlatformAdmin. See <code>docs/demo-mode.md</code> in the repository for details.
        </p>
      </section>

      <p><a routerLink="/">← Back to dashboard</a></p>
    </article>
  `,
  styles: [
    `
      .demo-help {
        max-width: 48rem;
      }
      .intro {
        color: var(--color-text-secondary);
        margin-bottom: var(--space-6);
      }
      section {
        margin-bottom: var(--space-6);
      }
      h1 {
        margin-bottom: var(--space-2);
      }
      h2 {
        font-size: var(--font-size-lg);
        margin-bottom: var(--space-3);
      }
      .credential-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm);
      }
      .credential-table th,
      .credential-table td {
        border: 1px solid var(--color-border);
        padding: var(--space-2) var(--space-3);
        text-align: left;
      }
      .credential-table th {
        background: var(--color-surface);
      }
      code {
        background: var(--color-neutral-light);
        padding: 0.1rem 0.35rem;
        border-radius: var(--radius-sm);
        font-size: 0.9em;
      }
      ol {
        padding-left: var(--space-5);
        color: var(--color-text-secondary);
      }
      ol li {
        margin-bottom: var(--space-2);
      }
      a {
        color: var(--color-primary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoHelpPageComponent {}
