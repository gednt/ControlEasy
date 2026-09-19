/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1VisitsGet } from '../fn/visits/api-v-1-visits-get';
import { ApiV1VisitsGet$Params } from '../fn/visits/api-v-1-visits-get';
import { apiV1VisitsIdCheckinPost } from '../fn/visits/api-v-1-visits-id-checkin-post';
import { ApiV1VisitsIdCheckinPost$Params } from '../fn/visits/api-v-1-visits-id-checkin-post';
import { apiV1VisitsIdCheckoutPost } from '../fn/visits/api-v-1-visits-id-checkout-post';
import { ApiV1VisitsIdCheckoutPost$Params } from '../fn/visits/api-v-1-visits-id-checkout-post';
import { apiV1VisitsIdGet } from '../fn/visits/api-v-1-visits-id-get';
import { ApiV1VisitsIdGet$Params } from '../fn/visits/api-v-1-visits-id-get';
import { apiV1VisitsPost } from '../fn/visits/api-v-1-visits-post';
import { ApiV1VisitsPost$Params } from '../fn/visits/api-v-1-visits-post';

@Injectable({ providedIn: 'root' })
export class VisitsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1VisitsGet()` */
  static readonly ApiV1VisitsGetPath = '/api/v1/visits';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VisitsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsGet$Response(params?: ApiV1VisitsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VisitsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VisitsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsGet(params?: ApiV1VisitsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VisitsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VisitsPost()` */
  static readonly ApiV1VisitsPostPath = '/api/v1/visits';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VisitsPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VisitsPost$Response(params: ApiV1VisitsPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VisitsPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VisitsPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VisitsPost(params: ApiV1VisitsPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VisitsPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VisitsIdGet()` */
  static readonly ApiV1VisitsIdGetPath = '/api/v1/visits/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VisitsIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdGet$Response(params: ApiV1VisitsIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VisitsIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VisitsIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdGet(params: ApiV1VisitsIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VisitsIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VisitsIdCheckinPost()` */
  static readonly ApiV1VisitsIdCheckinPostPath = '/api/v1/visits/{id}/checkin';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VisitsIdCheckinPost()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdCheckinPost$Response(params: ApiV1VisitsIdCheckinPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VisitsIdCheckinPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VisitsIdCheckinPost$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdCheckinPost(params: ApiV1VisitsIdCheckinPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VisitsIdCheckinPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VisitsIdCheckoutPost()` */
  static readonly ApiV1VisitsIdCheckoutPostPath = '/api/v1/visits/{id}/checkout';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VisitsIdCheckoutPost()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdCheckoutPost$Response(params: ApiV1VisitsIdCheckoutPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VisitsIdCheckoutPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VisitsIdCheckoutPost$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VisitsIdCheckoutPost(params: ApiV1VisitsIdCheckoutPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VisitsIdCheckoutPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
