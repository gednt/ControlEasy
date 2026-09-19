/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1AccessEventsGet } from '../fn/access-events/api-v-1-access-events-get';
import { ApiV1AccessEventsGet$Params } from '../fn/access-events/api-v-1-access-events-get';
import { apiV1AccessEventsManualPost } from '../fn/access-events/api-v-1-access-events-manual-post';
import { ApiV1AccessEventsManualPost$Params } from '../fn/access-events/api-v-1-access-events-manual-post';
import { apiV1AccessEventsRefusedAttemptsGet } from '../fn/access-events/api-v-1-access-events-refused-attempts-get';
import { ApiV1AccessEventsRefusedAttemptsGet$Params } from '../fn/access-events/api-v-1-access-events-refused-attempts-get';
import { apiV1AccessEventsScansPost } from '../fn/access-events/api-v-1-access-events-scans-post';
import { ApiV1AccessEventsScansPost$Params } from '../fn/access-events/api-v-1-access-events-scans-post';

@Injectable({ providedIn: 'root' })
export class AccessEventsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1AccessEventsScansPost()` */
  static readonly ApiV1AccessEventsScansPostPath = '/api/v1/access-events/scans';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessEventsScansPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessEventsScansPost$Response(params: ApiV1AccessEventsScansPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessEventsScansPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessEventsScansPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessEventsScansPost(params: ApiV1AccessEventsScansPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessEventsScansPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessEventsGet()` */
  static readonly ApiV1AccessEventsGetPath = '/api/v1/access-events';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessEventsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessEventsGet$Response(params?: ApiV1AccessEventsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessEventsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessEventsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessEventsGet(params?: ApiV1AccessEventsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessEventsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessEventsRefusedAttemptsGet()` */
  static readonly ApiV1AccessEventsRefusedAttemptsGetPath = '/api/v1/access-events/refused-attempts';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessEventsRefusedAttemptsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessEventsRefusedAttemptsGet$Response(params?: ApiV1AccessEventsRefusedAttemptsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessEventsRefusedAttemptsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessEventsRefusedAttemptsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessEventsRefusedAttemptsGet(params?: ApiV1AccessEventsRefusedAttemptsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessEventsRefusedAttemptsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessEventsManualPost()` */
  static readonly ApiV1AccessEventsManualPostPath = '/api/v1/access-events/manual';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessEventsManualPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessEventsManualPost$Response(params: ApiV1AccessEventsManualPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessEventsManualPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessEventsManualPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessEventsManualPost(params: ApiV1AccessEventsManualPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessEventsManualPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
