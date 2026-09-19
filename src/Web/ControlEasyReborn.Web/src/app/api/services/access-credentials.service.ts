/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1AccessCredentialsGet } from '../fn/access-credentials/api-v-1-access-credentials-get';
import { ApiV1AccessCredentialsGet$Params } from '../fn/access-credentials/api-v-1-access-credentials-get';
import { apiV1AccessCredentialsIdGet } from '../fn/access-credentials/api-v-1-access-credentials-id-get';
import { ApiV1AccessCredentialsIdGet$Params } from '../fn/access-credentials/api-v-1-access-credentials-id-get';
import { apiV1AccessCredentialsIdReplacePost } from '../fn/access-credentials/api-v-1-access-credentials-id-replace-post';
import { ApiV1AccessCredentialsIdReplacePost$Params } from '../fn/access-credentials/api-v-1-access-credentials-id-replace-post';
import { apiV1AccessCredentialsIdRevokePost } from '../fn/access-credentials/api-v-1-access-credentials-id-revoke-post';
import { ApiV1AccessCredentialsIdRevokePost$Params } from '../fn/access-credentials/api-v-1-access-credentials-id-revoke-post';
import { apiV1AccessCredentialsPost } from '../fn/access-credentials/api-v-1-access-credentials-post';
import { ApiV1AccessCredentialsPost$Params } from '../fn/access-credentials/api-v-1-access-credentials-post';

@Injectable({ providedIn: 'root' })
export class AccessCredentialsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1AccessCredentialsIdGet()` */
  static readonly ApiV1AccessCredentialsIdGetPath = '/api/v1/access-credentials/{id}';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessCredentialsIdGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessCredentialsIdGet$Response(params: ApiV1AccessCredentialsIdGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessCredentialsIdGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessCredentialsIdGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessCredentialsIdGet(params: ApiV1AccessCredentialsIdGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessCredentialsIdGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessCredentialsGet()` */
  static readonly ApiV1AccessCredentialsGetPath = '/api/v1/access-credentials';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessCredentialsGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessCredentialsGet$Response(params?: ApiV1AccessCredentialsGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessCredentialsGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessCredentialsGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1AccessCredentialsGet(params?: ApiV1AccessCredentialsGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessCredentialsGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessCredentialsPost()` */
  static readonly ApiV1AccessCredentialsPostPath = '/api/v1/access-credentials';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessCredentialsPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsPost$Response(params: ApiV1AccessCredentialsPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessCredentialsPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessCredentialsPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsPost(params: ApiV1AccessCredentialsPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessCredentialsPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessCredentialsIdReplacePost()` */
  static readonly ApiV1AccessCredentialsIdReplacePostPath = '/api/v1/access-credentials/{id}/replace';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessCredentialsIdReplacePost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsIdReplacePost$Response(params: ApiV1AccessCredentialsIdReplacePost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessCredentialsIdReplacePost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessCredentialsIdReplacePost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsIdReplacePost(params: ApiV1AccessCredentialsIdReplacePost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessCredentialsIdReplacePost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

  /** Path part for operation `apiV1AccessCredentialsIdRevokePost()` */
  static readonly ApiV1AccessCredentialsIdRevokePostPath = '/api/v1/access-credentials/{id}/revoke';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessCredentialsIdRevokePost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsIdRevokePost$Response(params: ApiV1AccessCredentialsIdRevokePost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessCredentialsIdRevokePost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessCredentialsIdRevokePost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessCredentialsIdRevokePost(params: ApiV1AccessCredentialsIdRevokePost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessCredentialsIdRevokePost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
