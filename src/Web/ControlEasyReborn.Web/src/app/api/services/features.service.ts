/* tslint:disable */
/* eslint-disable */
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';

import { apiV1FeaturesGet } from '../fn/features/api-v-1-features-get';
import { ApiV1FeaturesGet$Params } from '../fn/features/api-v-1-features-get';

@Injectable({ providedIn: 'root' })
export class FeaturesService extends BaseService {
  constructor(config: ApiConfiguration, http: HttpClient) {
    super(config, http);
  }

  /** Path part for operation `apiV1FeaturesGet()` */
  static readonly ApiV1FeaturesGetPath = '/api/v1/features';

  /**
   * This method provides access to the full `HttpResponse`, allowing access to response headers.
   * To access only the response body, use `apiV1FeaturesGet()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1FeaturesGet$Response(params?: ApiV1FeaturesGet$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    return apiV1FeaturesGet(this.http, this.rootUrl, params, context);
  }

  /**
   * This method provides access only to the response body.
   * To access the full response (for headers, for example), `apiV1FeaturesGet$Response()` instead.
   *
   * This method doesn't expect any request body.
   */
  apiV1FeaturesGet(params?: ApiV1FeaturesGet$Params, context?: HttpContext): Observable<void> {
    return this.apiV1FeaturesGet$Response(params, context).pipe(
      map((r: StrictHttpResponse<void>): void => r.body)
    );
  }

}
