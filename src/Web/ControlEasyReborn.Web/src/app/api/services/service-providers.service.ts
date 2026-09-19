/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1ServiceProvidersGet } from '../fn/service-providers/api-v-1-service-providers-get';
import { ApiV1ServiceProvidersGet$Params } from '../fn/service-providers/api-v-1-service-providers-get';
import { apiV1ServiceProvidersIdGet } from '../fn/service-providers/api-v-1-service-providers-id-get';
import { ApiV1ServiceProvidersIdGet$Params } from '../fn/service-providers/api-v-1-service-providers-id-get';
import { apiV1ServiceProvidersIdPut } from '../fn/service-providers/api-v-1-service-providers-id-put';
import { ApiV1ServiceProvidersIdPut$Params } from '../fn/service-providers/api-v-1-service-providers-id-put';
import { apiV1ServiceProvidersPost } from '../fn/service-providers/api-v-1-service-providers-post';
import { ApiV1ServiceProvidersPost$Params } from '../fn/service-providers/api-v-1-service-providers-post';

@Injectable({ providedIn: 'root' })
export class ServiceProvidersService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1ServiceProvidersGet()` */
  static readonly ApiV1ServiceProvidersGetPath = '/api/v1/service-providers';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ServiceProvidersGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ServiceProvidersGet$Response(params?: ApiV1ServiceProvidersGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ServiceProvidersGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ServiceProvidersGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ServiceProvidersGet(params?: ApiV1ServiceProvidersGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ServiceProvidersGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ServiceProvidersPost()` */
  static readonly ApiV1ServiceProvidersPostPath = '/api/v1/service-providers';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ServiceProvidersPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ServiceProvidersPost$Response(params: ApiV1ServiceProvidersPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ServiceProvidersPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ServiceProvidersPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ServiceProvidersPost(params: ApiV1ServiceProvidersPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ServiceProvidersPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ServiceProvidersIdGet()` */
  static readonly ApiV1ServiceProvidersIdGetPath = '/api/v1/service-providers/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ServiceProvidersIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ServiceProvidersIdGet$Response(params: ApiV1ServiceProvidersIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ServiceProvidersIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ServiceProvidersIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ServiceProvidersIdGet(params: ApiV1ServiceProvidersIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ServiceProvidersIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ServiceProvidersIdPut()` */
  static readonly ApiV1ServiceProvidersIdPutPath = '/api/v1/service-providers/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ServiceProvidersIdPut()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ServiceProvidersIdPut$Response(params: ApiV1ServiceProvidersIdPut$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ServiceProvidersIdPut(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ServiceProvidersIdPut$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ServiceProvidersIdPut(params: ApiV1ServiceProvidersIdPut$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ServiceProvidersIdPut$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
