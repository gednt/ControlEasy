/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1AccessSubjectsSearchPost } from '../fn/access-subjects/api-v-1-access-subjects-search-post';
import { ApiV1AccessSubjectsSearchPost$Params } from '../fn/access-subjects/api-v-1-access-subjects-search-post';

@Injectable({ providedIn: 'root' })
export class AccessSubjectsService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1AccessSubjectsSearchPost()` */
  static readonly ApiV1AccessSubjectsSearchPostPath = '/api/v1/access-subjects/search';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1AccessSubjectsSearchPost()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessSubjectsSearchPost$Response(params: ApiV1AccessSubjectsSearchPost$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1AccessSubjectsSearchPost(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1AccessSubjectsSearchPost$Response()` instead.
   *
   * This method sends `application/json` and handles request body of type `application/json`.
   */
  apiV1AccessSubjectsSearchPost(params: ApiV1AccessSubjectsSearchPost$Params, context?: HttpContext): Observable<void> {
    return this.apiV1AccessSubjectsSearchPost$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
