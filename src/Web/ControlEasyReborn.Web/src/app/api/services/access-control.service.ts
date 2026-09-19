/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1AccessControlMetaGet } from '../fn/access-control/api-v-1-access-control-meta-get';
import { ApiV1AccessControlMetaGet$Params } from '../fn/access-control/api-v-1-access-control-meta-get';

@Injectable({ providedIn: 'root' })
export class AccessControlService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1AccessControlMetaGet()` */
  static readonly ApiV1AccessControlMetaGetPath = '/api/v1/access-control/_meta';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessControlMetaGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessControlMetaGet$Response(params?: ApiV1AccessControlMetaGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessControlMetaGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessControlMetaGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessControlMetaGet(params?: ApiV1AccessControlMetaGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessControlMetaGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
