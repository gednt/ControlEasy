namespace ControlEasyReborn.Modules.Security.Application.Abstractions;

public interface ITempPasswordGenerator
{
    string Generate(int length = 12);
}
