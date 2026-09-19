/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1ResidentsGet } from '../fn/residents/api-v-1-residents-get';
import { ApiV1ResidentsGet$Params } from '../fn/residents/api-v-1-residents-get';
import { apiV1ResidentsIdGet } from '../fn/residents/api-v-1-residents-id-get';
import { ApiV1ResidentsIdGet$Params } from '../fn/residents/api-v-1-residents-id-get';
import { apiV1ResidentsIdPut } from '../fn/residents/api-v-1-residents-id-put';
import { ApiV1ResidentsIdPut$Params } from '../fn/residents/api-v-1-residents-id-put';
import { apiV1ResidentsPost } from '../fn/residents/api-v-1-residents-post';
import { ApiV1ResidentsPost$Params } from '../fn/residents/api-v-1-residents-post';

@Injectable({ providedIn: 'root' })
export class ResidentsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1ResidentsGet()` */
  static readonly ApiV1ResidentsGetPath = '/api/v1/residents';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ResidentsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ResidentsGet$Response(params?: ApiV1ResidentsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ResidentsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ResidentsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ResidentsGet(params?: ApiV1ResidentsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ResidentsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ResidentsPost()` */
  static readonly ApiV1ResidentsPostPath = '/api/v1/residents';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ResidentsPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ResidentsPost$Response(params: ApiV1ResidentsPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ResidentsPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ResidentsPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ResidentsPost(params: ApiV1ResidentsPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ResidentsPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ResidentsIdGet()` */
  static readonly ApiV1ResidentsIdGetPath = '/api/v1/residents/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ResidentsIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ResidentsIdGet$Response(params: ApiV1ResidentsIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ResidentsIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ResidentsIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ResidentsIdGet(params: ApiV1ResidentsIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ResidentsIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ResidentsIdPut()` */
  static readonly ApiV1ResidentsIdPutPath = '/api/v1/residents/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ResidentsIdPut()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ResidentsIdPut$Response(params: ApiV1ResidentsIdPut$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ResidentsIdPut(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ResidentsIdPut$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ResidentsIdPut(params: ApiV1ResidentsIdPut$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ResidentsIdPut$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
