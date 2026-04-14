FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore
COPY CreatorPay.Domain/CreatorPay.Domain.csproj CreatorPay.Domain/
COPY CreatorPay.Application/CreatorPay.Application.csproj CreatorPay.Application/
COPY CreatorPay.Infrastructure/CreatorPay.Infrastructure.csproj CreatorPay.Infrastructure/
COPY CreatorPay.Api/CreatorPay.Api.csproj CreatorPay.Api/
RUN dotnet restore CreatorPay.Api/CreatorPay.Api.csproj

# Copy everything and build
COPY . .
RUN dotnet publish CreatorPay.Api/CreatorPay.Api.csproj -c Release -o /app/publish

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "CreatorPay.Api.dll"]
