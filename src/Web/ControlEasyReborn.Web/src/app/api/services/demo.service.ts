/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1DemoInfoGet } from '../fn/demo/api-v-1-demo-info-get';
import { ApiV1DemoInfoGet$Params } from '../fn/demo/api-v-1-demo-info-get';
import { apiV1DemoResetPost } from '../fn/demo/api-v-1-demo-reset-post';
import { ApiV1DemoResetPost$Params } from '../fn/demo/api-v-1-demo-reset-post';

@Injectable({ providedIn: 'root' })
export class DemoService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1DemoInfoGet()` */
  static readonly ApiV1DemoInfoGetPath = '/api/v1/demo/info';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1DemoInfoGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1DemoInfoGet$Response(params?: ApiV1DemoInfoGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1DemoInfoGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1DemoInfoGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1DemoInfoGet(params?: ApiV1DemoInfoGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1DemoInfoGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1DemoResetPost()` */
  static readonly ApiV1DemoResetPostPath = '/api/v1/demo/reset';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1DemoResetPost()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1DemoResetPost$Response(params?: ApiV1DemoResetPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1DemoResetPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1DemoResetPost$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1DemoResetPost(params?: ApiV1DemoResetPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1DemoResetPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
