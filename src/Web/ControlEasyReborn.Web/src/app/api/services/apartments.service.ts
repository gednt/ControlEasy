/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1ApartmentsGet } from '../fn/apartments/api-v-1-apartments-get';
import { ApiV1ApartmentsGet$Params } from '../fn/apartments/api-v-1-apartments-get';
import { apiV1ApartmentsIdGet } from '../fn/apartments/api-v-1-apartments-id-get';
import { ApiV1ApartmentsIdGet$Params } from '../fn/apartments/api-v-1-apartments-id-get';
import { apiV1ApartmentsIdPut } from '../fn/apartments/api-v-1-apartments-id-put';
import { ApiV1ApartmentsIdPut$Params } from '../fn/apartments/api-v-1-apartments-id-put';
import { apiV1ApartmentsPost } from '../fn/apartments/api-v-1-apartments-post';
import { ApiV1ApartmentsPost$Params } from '../fn/apartments/api-v-1-apartments-post';

@Injectable({ providedIn: 'root' })
export class ApartmentsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1ApartmentsGet()` */
  static readonly ApiV1ApartmentsGetPath = '/api/v1/apartments';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ApartmentsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ApartmentsGet$Response(params?: ApiV1ApartmentsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ApartmentsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ApartmentsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ApartmentsGet(params?: ApiV1ApartmentsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ApartmentsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ApartmentsPost()` */
  static readonly ApiV1ApartmentsPostPath = '/api/v1/apartments';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ApartmentsPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ApartmentsPost$Response(params: ApiV1ApartmentsPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ApartmentsPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ApartmentsPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ApartmentsPost(params: ApiV1ApartmentsPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ApartmentsPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ApartmentsIdGet()` */
  static readonly ApiV1ApartmentsIdGetPath = '/api/v1/apartments/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ApartmentsIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ApartmentsIdGet$Response(params: ApiV1ApartmentsIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ApartmentsIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ApartmentsIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1ApartmentsIdGet(params: ApiV1ApartmentsIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ApartmentsIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1ApartmentsIdPut()` */
  static readonly ApiV1ApartmentsIdPutPath = '/api/v1/apartments/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1ApartmentsIdPut()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ApartmentsIdPut$Response(params: ApiV1ApartmentsIdPut$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1ApartmentsIdPut(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1ApartmentsIdPut$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1ApartmentsIdPut(params: ApiV1ApartmentsIdPut$Params, context?: HttpContext): Observable<void> {
    return this.apiV1ApartmentsIdPut$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
