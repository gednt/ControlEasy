/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1VehiclesGet } from '../fn/vehicles/api-v-1-vehicles-get';
import { ApiV1VehiclesGet$Params } from '../fn/vehicles/api-v-1-vehicles-get';
import { apiV1VehiclesIdGet } from '../fn/vehicles/api-v-1-vehicles-id-get';
import { ApiV1VehiclesIdGet$Params } from '../fn/vehicles/api-v-1-vehicles-id-get';
import { apiV1VehiclesIdPut } from '../fn/vehicles/api-v-1-vehicles-id-put';
import { ApiV1VehiclesIdPut$Params } from '../fn/vehicles/api-v-1-vehicles-id-put';
import { apiV1VehiclesPost } from '../fn/vehicles/api-v-1-vehicles-post';
import { ApiV1VehiclesPost$Params } from '../fn/vehicles/api-v-1-vehicles-post';

@Injectable({ providedIn: 'root' })
export class VehiclesService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1VehiclesGet()` */
  static readonly ApiV1VehiclesGetPath = '/api/v1/vehicles';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VehiclesGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VehiclesGet$Response(params?: ApiV1VehiclesGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VehiclesGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VehiclesGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VehiclesGet(params?: ApiV1VehiclesGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VehiclesGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VehiclesPost()` */
  static readonly ApiV1VehiclesPostPath = '/api/v1/vehicles';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VehiclesPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VehiclesPost$Response(params: ApiV1VehiclesPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VehiclesPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VehiclesPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VehiclesPost(params: ApiV1VehiclesPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VehiclesPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VehiclesIdGet()` */
  static readonly ApiV1VehiclesIdGetPath = '/api/v1/vehicles/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VehiclesIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VehiclesIdGet$Response(params: ApiV1VehiclesIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VehiclesIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VehiclesIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1VehiclesIdGet(params: ApiV1VehiclesIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VehiclesIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1VehiclesIdPut()` */
  static readonly ApiV1VehiclesIdPutPath = '/api/v1/vehicles/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1VehiclesIdPut()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VehiclesIdPut$Response(params: ApiV1VehiclesIdPut$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1VehiclesIdPut(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1VehiclesIdPut$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1VehiclesIdPut(params: ApiV1VehiclesIdPut$Params, context?: HttpContext): Observable<void> {
    return this.apiV1VehiclesIdPut$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
